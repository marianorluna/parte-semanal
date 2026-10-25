# Operaciones

Cómo se despliega, se respalda, se monitoriza y se recupera LeviParte. Para el diseño técnico, consulta [`architecture.md`](./architecture.md); para el comportamiento funcional, [`product.md`](./product.md).

## 1. Topología

```mermaid
flowchart TB
  U["Usuarios e integraciones"] -->|"HTTPS"| T["Proxy de Coolify con TLS"]
  T --> A["Contenedor app: Next.js en el puerto 3000"]
  A -->|"red interna"| D[("PostgreSQL 16")]
  D --> V["Volumen parte_diario_pgdata"]
  A -->|"salida opcional"| S["SMTP"]
  A -->|"salida opcional"| I["Proveedor de IA"]
  A -->|"webhooks"| W["Sistemas del cliente"]
  B["Backup programado fuera del VPS"] -.-> D
```

- Un único recurso Docker Compose en Coolify levanta `app` y `db`.
- PostgreSQL no publica puertos: solo se llega por la red interna del stack.
- El proxy de Coolify gestiona TLS con Let's Encrypt para `https://horas.levitec.marianorluna.com`.
- El dominio se configura en la UI del recurso o con `SERVICE_FQDN_APP_3000`.
- El volumen `parte_diario_pgdata` sobrevive a los redespliegues.
- El `Dockerfile` es multi-stage y produce una imagen standalone con Node 22.

## 2. Variables de producción

Obligatorias:

| Variable | Valor | Efecto si falta |
|----------|-------|-----------------|
| `AUTH_SECRET` | Secreto de al menos 32 caracteres | El entrypoint aborta y el contenedor reinicia en bucle |
| `POSTGRES_PASSWORD` | Contraseña fuerte, sin `+`, `/` ni `@` | La URL de conexión se rompe |
| `APP_URL` | `https://horas.levitec.marianorluna.com` | Enlaces de correo y redirecciones incorrectos |
| `POSTGRES_USER` | `parte_diario` | Se usa el valor por defecto |
| `POSTGRES_DB` | `parte_diario` | Se usa el valor por defecto |
| `TZ` | `Europe/Madrid` | Fechas y cron en otra zona |

Opcionales:

| Variable | Efecto |
|----------|--------|
| `CRON_SECRET` | Autoriza los endpoints de cron. Sin él responden 503 |
| `SMTP_URL` | Envía correos. Sin ella quedan en `SIN_PROVEEDOR` |
| `SMTP_FROM` | Remitente visible |
| `IA_API_KEY`, `IA_MODELO` | Activan el asistente. Sin ambas, 503 `NO_CONFIGURADO` |
| `IA_BASE_URL`, `IA_TIMEOUT_MS`, `IA_MAX_TOKENS`, `IA_PSEUDONIMIZAR` | Ajuste del proveedor de IA |
| `INFORMES_WORKER` | Con `off`, no arranca el worker de `pg-boss` en este proceso |
| `DEMO_PASSWORD` | Contraseña del demo. No debe usarse en producción con datos reales |
| `ACCESO_RAPIDO_DEMO` | Debe quedar en `false` o sin definir en producción |

`API_KEY`, `WEBHOOK_SECRET` y `S3_BACKUP_BUCKET` figuran en `.env.example` como reservadas y el código no las usa. Las claves de API y los secretos de webhook se crean desde la interfaz; el backup se configura fuera de la aplicación.

Genera secretos con `openssl rand -base64 32` para `AUTH_SECRET` y `openssl rand -hex 32` para `CRON_SECRET`.

No hay `NEXT_PUBLIC_*`: ningún secreto se expone al navegador. Las claves de API y los secretos de webhook no viven en el entorno; se crean desde Administración > API y se guardan con HMAC en base de datos.

## 3. Despliegue

### 3.1 Primer despliegue

1. En Coolify, crea un recurso **Docker Compose** apuntando a la rama `main` del repositorio.
2. Carga las variables de la sección 2 en el entorno del recurso.
3. Configura el dominio `horas.levitec.marianorluna.com` en el puerto 3000.
4. Despliega. El orden es: build, arranque de `db`, healthcheck del `db`, arranque de `app`, migraciones del entrypoint, `server.js`.
5. Comprueba `GET /api/health`, el login y un flujo de imputación con el usuario real.

### 3.2 Despliegue normal

```text
push a main
  → GitHub Actions: lint, tipado, tests, migraciones sobre Postgres limpio, build
  → webhook a Coolify
  → build de la imagen
  → entrypoint aplica migraciones pendientes
  → healthcheck /api/health
  → el proxy enruta tráfico
```

Si el healthcheck falla, Coolify mantiene la versión anterior. Si el contenedor entra en bucle, revisa las Runtime Logs, no solo las Deployment Logs.

### 3.3 Migraciones

- Viven en `src/db/migrations/` y se aplican con `scripts/migrate.mjs`.
- El script espera hasta 30 intentos de 3 segundos a que la base de datos responda.
- Registra cada archivo en `migracion_aplicada`; es idempotente.
- Deben ser aditivas y compatibles hacia atrás (expand/contract). Un rollback de imagen no revierte la base de datos.
- Un cambio destructivo se hace en dos despliegues: primero se deja de usar la columna, después se elimina.
- Antes de un cambio de esquema relevante, prueba en staging con una copia o con el demo. La migración `0011` (desviación firmada, proyecto de ajuste y su índice parcial) se valida allí antes de producción.

### 3.4 Rollback

1. En Coolify, redespliega la imagen o el commit anterior.
2. No revertir migraciones aplicadas salvo que el cambio sea estrictamente aditivo y esté probado.
3. Si el esquema nuevo es incompatible con la imagen anterior, el rollback exige restaurar un backup. Es la razón de mantener expand/contract.

## 4. Health y monitorización

### 4.1 `GET /api/health`

Responde 200 mientras la base de datos esté accesible.

```json
{
  "status": "ok",
  "database": "ok",
  "cola": "ok",
  "jobsFallidos": 0,
  "version": "0.1.0",
  "timestamp": "2026-10-25T13:00:00.000Z"
}
```

- `503`: la base de datos no responde.
- `status: "degraded"` con 200: la cola no está iniciada, no es accesible o hay jobs fallidos. No reinicia el contenedor a propósito.
- La sonda del Dockerfile llama a este endpoint cada 30 segundos, con 5 de timeout y 3 reintentos.

### 4.2 `GET /api/v1/cron/salud`

Pensada para un monitor externo. Exige `CRON_SECRET`.

- 200 con `alerta: false` y `jobsFallidos` por debajo de 5.
- 503 con `alerta: true` a partir de 5 jobs fallidos.
- 200 con `cola: "no-iniciada"` si `pg-boss` todavía no ha creado su esquema.

Configura una alerta sobre el 503 de esta sonda, no sobre `/api/health`, para no reiniciar la app por un job fallido.

### 4.3 Señales en la aplicación

| Señal | Dónde | Qué indica |
|-------|-------|------------|
| Correos en `FALLIDO` o `SIN_PROVEEDOR` | `/admin/emails` | SMTP caído o sin configurar |
| Entregas en `FALLIDO` o `AGOTADO` | `/admin/api` | Webhook caído o respuesta no 2xx |
| Informes en `FALLIDO` | `/admin/informes` | Error de generación; se puede reintentar |
| Jobs fallidos | `/api/health` y `/api/v1/cron/salud` | Fallo en la cola |
| Cambios y accesos | `/admin/auditoria` | Trazabilidad de negocio y sesión |

### 4.4 Logs

Los logs van a stdout y Coolify los recoge. Busca los prefijos:

- `[entrypoint]`: arranque y migraciones.
- `[informes]`: worker, generación y limpieza.
- `[email]`: envío.
- `[webhooks]`: outbox y entregas.
- `[cron/avisos]`, `[cron/webhooks]`: ejecuciones manuales.

No se registran contraseñas, prompts de IA, respuestas del modelo ni secretos.

## 5. Backups y restauración

### 5.1 Qué respaldar

- La base de datos completa. Es la única fuente de verdad; los informes generados caducan a los 7 días y no necesitan backup.
- Las variables de entorno y secretos, en el gestor de secretos de Coolify o en uno corporativo.
- El `.env` de producción no vive en el repositorio.

El repositorio no incluye un programador de backups: se configura fuera de la aplicación, con el backup de Coolify o con un cron del host. En cualquier caso, la copia debe salir del VPS.

### 5.2 Backup manual

```bash
docker compose exec -T db pg_dump -U parte_diario -Fc parte_diario \
  > parte-diario-$(date +%F).dump
```

Recomendaciones:

- Frecuencia diaria y retención mínima de 30 días.
- Cifrado en reposo y en tránsito si el destino es almacenamiento externo.
- Un backup en el mismo disco no protege de la pérdida del servidor.
- Verifica el tamaño y la fecha del fichero, no solo que el comando termine con 0.

### 5.3 Restauración

Nunca encima de producción.

```bash
# 1. Crea una base limpia en un entorno aislado
docker compose exec -T db createdb -U parte_diario parte_diario_restaurada

# 2. Restaura el dump
cat parte-diario-2026-10-24.dump | docker compose exec -T db pg_restore \
  -U parte_diario -d parte_diario_restaurada --clean --if-exists

# 3. Apunta un entorno de pruebas a esa base y arranca
DATABASE_URL=postgresql://parte_diario:...@localhost:5432/parte_diario_restaurada npm run dev
```

Comprobación:

- [ ] `npm run db:migrate` termina con las migraciones al día.
- [ ] `/api/health` responde 200 con `database: ok`.
- [ ] Un usuario puede iniciar sesión y ver sus partes de la última semana.
- [ ] El número de filas de `parte` e `imputacion` coincide con el origen.
- [ ] Un parte aprobado conserva su cómputo y su coste.
- [ ] La restauración se ha hecho al menos una vez antes del go-live.

Este último punto sigue pendiente y es un bloqueador declarado.

## 6. Colas y tareas programadas

### 6.1 Colas de `pg-boss`

| Cola | Disparo | Función |
|------|---------|---------|
| `informes` | Al solicitar un informe | Genera CSV, XLSX o PDF |
| `limpieza-informes` | Diario a las 03:00 y al arrancar | Borra contenido caducado a los 7 días |
| `emails` | Al encolar un aviso | Envía por SMTP y guarda el estado |
| `webhooks` | Cada minuto | Procesa outbox y reintentos |

El worker arranca desde `instrumentation.ts` una sola vez por proceso. Reiniciar el contenedor interrumpe el job en curso; `pg-boss` lo reintenta y los jobs son idempotentes.

### 6.2 Cron de avisos

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://horas.levitec.marianorluna.com/api/v1/cron/avisos?modo=recordatorios&semana=actual&ventana=viernes"
```

Programación recomendada:

| Cuándo | Petición |
|--------|----------|
| Viernes 13:00 | `modo=recordatorios&semana=actual&ventana=viernes` |
| Lunes 09:00 | `modo=recordatorios&semana=anterior&ventana=lunes` |
| Diario 07:00 | `modo=riesgos&ventana=manual` |
| Manual | `modo=todo&dryRun=1` para previsualizar |

La ventana forma parte de la clave de idempotencia, no es un filtro de día. Si programas el cron el día equivocado, se generarán avisos igualmente.

### 6.3 Despacho manual de webhooks

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://horas.levitec.marianorluna.com/api/v1/cron/webhooks"
```

Devuelve `outbox`, `enviadas`, `fallidas` y `agotadas`. Úsalo tras una incidencia de red, no en cada despliegue.

### 6.4 Asistente de IA

- **Activación:** define `IA_API_KEY` e `IA_MODELO`. Con una de las dos vacía, las herramientas responden `NO_CONFIGURADO` (503) y la app sigue igual.
- **Proveedor:** `IA_BASE_URL` apunta a cualquier servicio compatible con el protocolo de chat de OpenAI. Por defecto `https://api.deepseek.com`; OpenAI y OpenRouter funcionan cambiando URL y modelo.
- **Ajuste:** `IA_TIMEOUT_MS` acota la espera (1.000 a 60.000 ms) y `IA_MAX_TOKENS` la salida (100 a 2.000). La salida se normaliza y se trunca a 1.500 caracteres.
- **Límites:** 20 consultas por usuario y minuto, 1 por segundo. El contador vive en memoria del proceso, suficiente con una réplica. Al superarlo, `DEMASIADAS_PETICIONES` (429).
- **Privacidad:** `IA_PSEUDONIMIZAR=true` reduce los nombres a inicial y apellido. El contexto excluye correos e identificadores internos y delimita los datos en `<datos>`. La auditoría guarda modelo y tokens, nunca el prompt ni la respuesta.
- **Coste orientativo:** cada consulta envía como máximo un resumen semanal acotado (10 personas y 5 proyectos) o 40 líneas de un parte, con un tope de 700 tokens de salida por defecto. El coste real depende del modelo y de la tarifa del proveedor; revísalo antes de activarlo en un flujo con muchos encargados.
- **Apagado seguro:** deja `IA_API_KEY` vacía y redespliega. No hay migración ni dato que limpiar.
- **Diagnóstico:** `503 NO_CONFIGURADO` por falta de configuración; `429 DEMASIADAS_PETICIONES` por límite; `502 SERVICIO_EXTERNO` si el proveedor falla, tarda o devuelve algo inválido. En los tres casos el flujo manual sigue disponible.
- **Aviso legal:** con datos reales, verifica DPA, retención, uso para entrenamiento y transferencia internacional del proveedor antes de activarlo.

## 7. Seguridad operativa

- **TLS:** gestionado por Coolify. Renovación automática; verifica el certificado tras cambiar de dominio.
- **Base de datos:** sin puertos publicados; solo accesible por la red interna. `db` no debe exponerse en el VPS.
- **Secretos:** en Coolify, nunca en el repositorio ni en una imagen. Rota `AUTH_SECRET` solo con un plan: invalida las sesiones activas y los hashes de claves de API.
- **Contraseñas:** argon2id. El reseteo lo hace un `ADMIN` desde Administración > Usuarios.
- **Acceso al VPS:** claves SSH, sin contraseña, y usuarios nominales. Coolify no debe compartir credenciales entre personas.
- **Backups:** cifrados si salen del VPS. Un backup sin probar no es un backup.
- **Datos personales:** el correo y los webhooks sacan nombres y horas del sistema. El destino debe estar autorizado y con base legal.
- **IA:** antes de usar datos reales, verifica DPA, retención, uso para entrenamiento y transferencia internacional del proveedor. Si no está validado, mantén `IA_API_KEY` vacía.
- **Auditoría:** no se borra. Si necesitas purgar datos personales por una solicitud de baja, hazlo con un procedimiento revisado y dejando constancia, no con un `DELETE` manual improvisado.

### Rotación de una clave de API

1. Crea una clave nueva con los mismos alcances.
2. Despliega el cambio en el integrador y verifica que funciona.
3. Revoca la anterior desde Administración > API.
4. Revisa el último uso de la clave antigua para confirmar que no hay tráfico.

### Rotación del secreto de un webhook

1. Crea un webhook nuevo con la misma URL y eventos, o rota el secreto si la UI lo permite.
2. Actualiza el verificador del receptor.
3. Desactiva el webhook anterior después de confirmar entregas correctas.

## 8. Runbook

### La app no arranca y el contenedor reinicia

1. Abre las Runtime Logs del contenedor `app`.
2. Si el mensaje es `AUTH_SECRET debe tener al menos 32 caracteres`, corrige la variable.
3. Si es un error de conexión, comprueba que `db` está `healthy` y que `POSTGRES_PASSWORD` no contiene `+`, `/` ni `@`.
4. Si falla una migración, no la saltes: revisa el SQL, corrige en una migración nueva y vuelve a desplegar.

### El dominio responde 503 pero el deploy dice Success

El contenedor está en bucle y Coolify no lo refleja. Mira las Runtime Logs, corrige la variable y redespliega.

### La base de datos no responde

1. Comprueba el servicio `db` y el volumen.
2. Revisa el disco del VPS. Un disco lleno tumba PostgreSQL.
3. Si hay corrupción, restaura el último backup en una base nueva y apunta la app a ella.
4. No ejecutes `docker compose down -v`: borra el volumen.

### Job de informe atascado o fallido

1. Revisa `/admin/informes` y el estado del job.
2. Reintenta desde la pantalla; renueva la caducidad del contenido.
3. Si el fallo se repite, revisa el rango: máximo 10.000 filas y 366 días.
4. Comprueba `/api/v1/cron/salud` para saber si hay más jobs fallidos.

### Correos en `SIN_PROVEEDOR`

Falta `SMTP_URL`. Configúrala, redespliega y reintenta desde `/admin/emails`. No es un fallo reintentable por la cola: reintentar sin proveedor no cambia nada.

### Correos en `FALLIDO`

1. Revisa el error en `/admin/emails`.
2. Comprueba credenciales, puerto, TLS y límites del proveedor.
3. Reintenta. La cola aplica backoff.
4. Si el proveedor bloquea el dominio, revisa SPF, DKIM y DMARC.

### Webhooks en `AGOTADO`

1. Revisa la URL y el estado del receptor en `/admin/api`.
2. Comprueba que responde 2xx en menos de 10 segundos.
3. Verifica la firma con el secreto correcto y un reloj sincronizado.
4. Crea una entrega nueva o espera al siguiente evento; una entrega agotada no se reintenta sola.

### La IA falla o va lenta

- `NO_CONFIGURADO`: faltan `IA_API_KEY` o `IA_MODELO`. La app sigue funcionando.
- `SERVICIO_EXTERNO`: el proveedor falla o tarda. El flujo manual sigue disponible.
- `DEMASIADAS_PETICIONES`: límite de 20 por minuto o 1 por segundo por usuario.
- Para apagarla sin desplegar código, deja `IA_API_KEY` vacía y redespliega.

### Hay que purgar el demo en producción

```bash
npm run db:seed:demo:purge -- --yes
```

Borra solo la empresa `DEMO`. Úsalo antes de dar de alta personal real, porque el email de usuario es único global. No ejecutes el seed en producción sin `--yes` y sin una razón. El seed nunca forma parte del despliegue automático, pero `/admin/demo` está protegida solo por rol `ADMIN` y no se autobloquea por entorno: limita quién tiene ese rol.

### Se ha cerrado un periodo por error

Reabre el periodo en Administración > Cierres con un motivo. Los partes vuelven a `APROBADO` si ningún otro cierre los cubre, y se recalcula cómputo y coste. La operación queda auditada.

## 9. Capacidad y escalado

- Una réplica con 2 vCPU y 4 GB cubre el volumen previsto (1.000 trabajadores, picos jueves y viernes).
- La primera palanca es vertical: más CPU y memoria para app y PostgreSQL.
- Antes de escalar horizontalmente, mueve el rate limit de IA y la ejecución del worker a un servicio compartido; hoy el limitador vive en memoria del proceso.
- Si los informes compiten con la base de datos, extrae el worker a un contenedor propio. Los casos de uso no cambian.
- Si el volumen de webhooks crece, el outbox ya absorbe picos; vigila `jobsFallidos` y el tiempo de entrega.

## 10. Checklist de go-live

- [ ] Dominio con TLS válido y renovación automática.
- [ ] `AUTH_SECRET`, `POSTGRES_PASSWORD` y `CRON_SECRET` propios de producción.
- [ ] `ACCESO_RAPIDO_DEMO` desactivado.
- [ ] Demo purgado si se va a cargar personal real.
- [ ] `SMTP_URL` real y un correo de prueba recibido.
- [ ] Cron de avisos programado y verificado con `dryRun=1`.
- [ ] Webhooks del cliente configurados y una entrega de prueba correcta.
- [ ] Backup programado fuera del VPS y restauración probada.
- [ ] Monitor externo sobre `/api/v1/cron/salud`.
- [ ] Smoke test del flujo completo: alta de usuario, imputación, envío, aprobación, cierre, informe y exportación.
- [ ] DPA del proveedor de IA revisado antes de activarlo con datos reales.
- [ ] Runbook revisado con la persona de guardia.

## 11. Pendientes operativos

- Restaurar un backup en local o staging para validar la recuperación.
- Configurar `SMTP_URL` real y probar la entrega en producción.
- Aprobar `@playwright/test` para cubrir el flujo crítico.
- Decidir si el backup programado vive en Coolify o en un cron del host, y documentarlo aquí.
- Mover el rate limit de IA a un almacén compartido si se añade una segunda réplica.
