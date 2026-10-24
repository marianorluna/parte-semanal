# Onboarding - Setup local

Guía para levantar el proyecto desde cero.

## Stack y producto

- **Stack:** [`AGENTS.md` §2](../AGENTS.md#2-stack-del-proyecto)
- **Producto / dominio:** [`AGENTS.md` §3](../AGENTS.md#3-contexto-de-negocio)
- **Capas / carpetas:** [`docs/architecture.md`](./architecture.md)

---

## Requisitos previos

- [ ] Node 22 o superior (`node -v`) y npm
- [ ] Docker con `docker compose` para el Postgres local
- [ ] Acceso al repositorio en GitHub
- [ ] `openssl` para generar el secreto de Auth.js

---

## 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
cd parte-diario
```

---

## 2. Variables de entorno

```bash
cp .env.example .env
```

Descomenta y ajusta al menos:

```dotenv
DATABASE_URL=postgresql://parte_diario:parte_diario@localhost:5432/parte_diario
APP_URL=http://localhost:3000
AUTH_SECRET=<salida de: openssl rand -base64 32>
TZ=Europe/Madrid
DEMO_PASSWORD=Demo1234!
```

`AUTH_SECRET` es obligatorio: sin él la app no arranca. Nunca reutilices el valor de un entorno real ni commitees `.env`.

---

## 3. Instalar dependencias

```bash
npm install
```

---

## 4. Base de datos

El `compose.yml` contiene el stack completo, pero en local solo necesitas el
servicio `db` porque la app corre con `npm run dev`. El puerto del host lo
aporta `compose.override.yml`, que Compose carga solo cuando no se pasa `-f`:

```bash
docker compose up -d db
docker compose ps          # el healthcheck debe estar en healthy
npm run db:migrate         # aplica las migraciones de src/db/migrations
```

Comandos auxiliares:

| Comando | Uso |
|---------|-----|
| `npm run db:generate` | Genera una migración tras cambiar el esquema |
| `npm run db:studio` | Abre Drizzle Studio |
| `npm run db:seed:demo` | Carga el demo completo (50 usuarios, 10 proyectos, 6 semanas) |
| `npm run db:seed:demo -- --refresh` | Purga y recarga el demo relativo a la semana actual |
| `npm run db:seed:demo:purge` | Borra solo la empresa `DEMO` |

Para probar la imagen de producción sin Coolify:

```bash
docker compose up --build -d   # app + db con el mismo compose del despliegue
docker compose ps              # ambos servicios en healthy
docker compose logs -f app     # migraciones del entrypoint y arranque de Next
```

La app queda accesible por la red interna (`app:3000`), no en un puerto del
host: es el proxy de Coolify el que la publica en producción. Este comando
fusiona `compose.override.yml`, así que el `db` sí expone `127.0.0.1:5432` para
tu cliente SQL. Para emular el stack exacto de producción usa
`docker compose -f compose.yml up --build -d` (sin puertos publicados del `db`).

---

## 5. Levantar el servidor de desarrollo

```bash
npm run dev
```

La app queda en `http://localhost:3000`. `/api/health` responde `{"status":"ok","database":"ok"}` cuando la base de datos está accesible.

### Cuentas del demo

Las tres cuentas de acceso rápido usan correos genéricos. El resto sigue el formato inicial del nombre más los apellidos sobre `@levitec.es`.

| Rol | Nombre | Email | Contraseña |
|-----|--------|-------|------------|
| ADMIN | David Sierra | `administrador@levitec.es` | `Demo1234!` (o `DEMO_PASSWORD`) |
| ENCARGADO | Fernando Nieto | `encargado@levitec.es` | igual |
| TRABAJADOR | Álvaro Méndez | `trabajador01@levitec.es` | igual |

El resto de encargados y trabajadores usa el patrón corporativo (`ralcaide@levitec.es`, `ipenalver@levitec.es`, ...).

Con `ACCESO_RAPIDO_DEMO=true` en `.env`, el login muestra tres botones de acceso directo (ADMIN, ENCARGADO, TRABAJADOR). Es provisional para el periodo de pruebas; la contraseña se resuelve en el servidor y no viaja al navegador. Quita la variable para ocultarlos.

---

## 6. Verificar que todo funciona

```bash
npm run lint
npm run typecheck
npm run test
```

- [ ] `/api/health` devuelve 200 con `database: ok`.
- [ ] El login de un trabajador demo abre `/mi-semana` con la semana actual y asignaciones.
- [ ] El panel rápido añade horas, ajusta en tramos de 30 minutos y permite deshacer.
- [ ] El login de un encargado muestra partes enviados en `/control/partes` y el estado del equipo en `/control/equipo`.
- [ ] El encargado no ve partes de otros encargados ni de administradores.
- [ ] `/control/dashboard` muestra alertas, cumplimiento y semáforo de riesgo por proyecto.
- [ ] Las exportaciones CSV, XLSX y PDF descargan con los filtros aplicados.
- [ ] `npm run db:seed:demo` dos veces seguidas no duplica filas.
- [ ] `npm run db:seed:demo:purge` deja la base sin filas `DEMO` y conserva otras empresas.

### Probar avisos y exportaciones

Con `CRON_SECRET` definido en `.env`:

```bash
# Previsualiza sin escribir en la base
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/v1/cron/avisos?semana=actual&dryRun=1"

# Genera los recordatorios de la semana actual; repetirlo no duplica avisos
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/v1/cron/avisos?semana=actual&modo=recordatorios"
```

Comprueba en `/notificaciones` que aparecen una sola vez. Si `CRON_SECRET` no está definido, el endpoint responde `503`.

Las exportaciones se generan en el servidor y no se cachean:

- `/control/partes/exportar?formato=csv|xlsx|pdf&y=2026&w=38`
- `/control/dashboard/exportar?formato=xlsx|pdf&y=2026&w=38`
- `/partes/<id>/pdf`

Abriendo el XLSX en Excel y el PDF en un lector se comprueban acentos, totales y paginación.

---

## Solución de problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| `Cannot find module` | Dependencias no instaladas | Ejecutar el paso 3 de nuevo |
| Error de conexión a BD | `.env` mal configurado o contenedor parado | Revisar `DATABASE_URL` y `docker compose up -d db` |
| `AUTH_SECRET` ausente | Falta la variable | Generarla con `openssl rand -base64 32` |
| `AUTH_SECRET` de menos de 32 caracteres | El valor generado a mano es corto | Volver a generarla con `openssl rand -base64 32` (44 caracteres) |
| Deploy en `Success` pero el dominio devuelve `503 no available server` y el contenedor `app` está en `Restarting` | El entrypoint aborta al arrancar (típicamente `AUTH_SECRET` corta o `POSTGRES_PASSWORD` con `+`, `/`, `@`) y Docker reinicia en bucle; Coolify no lo refleja porque `docker compose up -d` devolvió 0 | Abrir las **Runtime Logs** del contenedor `app` (no las Deployment Logs), corregir la variable y redesplegar |
| Puerto 3000 o 5432 ocupado | Otro proceso usa el puerto | Parar solo el proceso propio que sea seguro parar o cambiar el puerto |
| El demo no aparece en el dashboard | Semanas antiguas cargadas | `npm run db:seed:demo -- --refresh` |
| Aviso de hidratación en la consola del navegador (`A tree hydrated but some attributes...`) | Una extensión modifica el DOM antes de que React hidrate | Ver [Aviso de hidratación](#aviso-de-hidratación-en-la-consola) |

### Aviso de hidratación en la consola

React avisa cuando el HTML del servidor y el del cliente no coinciden. En desarrollo, el mensaje incluye
un diff con los atributos que sobran. Antes de tocar código, comprueba si esos atributos son nuestros:

1. Busca en el repositorio los nombres marcados en el diff: `rg "nombre_del_atributo" src`. Si no aparecen,
   los inyecta una extensión del navegador antes de que React hidrate, no la app.
2. Los sospechosos habituales son `bis_skin_checked`, `bis_register` (Bitdefender, su valor en base64
   contiene `"extensionId"`) y `__processed_<uuid>__` (otras extensiones de seguridad).
3. Confirma con una ventana de incógnito o desactivando la extensión para `localhost`: si el aviso
   desaparece, el origen está identificado.

Solo es un aviso de desarrollo: en producción no se muestra y la app funciona igual. No añadas
`suppressHydrationWarning` en `<body>` para silenciarlo, porque también ocultaría desajustes reales del
render. Si el diff no cuadra con ninguna extensión, entonces sí hay un desajuste propio: revisa los
patrones del mensaje (fechas o números formateados en el cliente, ramas con `typeof window`, HTML mal anidado).

---

## Contexto adicional

| Tema | Fuente |
|------|--------|
| Stack / producto | [`AGENTS.md`](../AGENTS.md) |
| Capas / carpetas / flujos | [`architecture.md`](./architecture.md) |
| Decisiones (ADRs) | [`decisions.md`](./decisions.md) |
| Guía de archivos / empieza aquí | [`start.md`](./start.md) |
