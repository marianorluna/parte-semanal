# API v1 e integraciones

Referencia de la API pública de LeviParte, del patrón de idempotencia y de los webhooks firmados. La API existe para integrar partes y horas con ERP, nómina, BI u otros sistemas; no expone administración, aprobación ni cierre.

- **Base:** `https://horas.levitec.marianorluna.com/api/v1`
- **Formato:** JSON UTF-8
- **Versión:** v1 en la ruta. Un cambio incompatible abre `/api/v2`.
- **OpenAPI:** `GET /api/v1/openapi.json` (público, sin autenticación, cacheado 5 minutos)

## 1. Autenticación

Cada integración usa una clave propia, creada en Administración > API.

```http
Authorization: Bearer lv_3f9a1c77b204_9d2e...
```

- Formato: `lv_<12 hex>_<40 hex>`.
- El secreto se muestra una sola vez al crearla. En base de datos solo queda un HMAC-SHA256 con `AUTH_SECRET` como pimienta.
- La clave puede tener fecha de caducidad y estado activo. Revocarla o caducarla corta el acceso al instante.
- Los alcances se asignan al crear la clave y no se pueden ampliar desde la petición.
- El uso queda registrado con fecha de último acceso.

### Alcances

| Alcance | Permite |
|---------|---------|
| `partes:leer` | `GET /partes` |
| `proyectos:leer` | `GET /proyectos` |
| `imputaciones:escribir` | `POST /imputaciones` |

Una clave con un alcance insuficiente recibe `403 SIN_PERMISO`. Una clave inexistente, revocada, caducada o con secreto incorrecto recibe `401 NO_AUTENTICADO` con el mismo mensaje, para no revelar cuál falló.

### Límite de peticiones

- 60 peticiones por clave y minuto natural UTC.
- El contador se consume en cada petición autenticada, también si la operación falla después.
- Al superarlo: `429 DEMASIADAS_PETICIONES`.
- El límite es por clave, no por IP. No sustituye a un WAF ni a un límite de red.

## 2. Formato de respuesta

Éxito:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDACION",
    "message": "Revisa los campos de la imputación",
    "fieldErrors": {
      "minutos": "Los minutos deben ser mayores que 0"
    }
  }
}
```

- Todas las respuestas llevan `Cache-Control: no-store`.
- Los errores no incluyen trazas ni nombres de tablas.
- `fieldErrors` solo aparece en errores de validación.

| Código | HTTP | Cuándo |
|--------|------|--------|
| `NO_AUTENTICADO` | 401 | Clave ausente, inválida, revocada o caducada |
| `SIN_PERMISO` | 403 | Falta el alcance o la tarea no está asignada al empleado |
| `NO_ENCONTRADO` | 404 | Empleado o recurso fuera de la empresa |
| `ESTADO_INVALIDO` | 409 | Parte en estado que no admite escritura, periodo cerrado o clave de idempotencia en curso |
| `CONFLICTO_VERSION` | 409 | Dos peticiones intentan crear el mismo parte a la vez; reintentar |
| `VALIDACION` | 422 | Cuerpo, parámetros o cabecera inválidos |
| `DEMASIADAS_PETICIONES` | 429 | Límite por minuto superado |
| `ERROR_INTERNO` | 500 | Fallo no esperado |

## 3. Endpoints

### 3.1 `GET /partes`

Lista partes de la empresa de la clave.

| Parámetro | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `isoYear` | entero 2000-2100 | No | Año ISO |
| `isoWeek` | entero 1-53 | No | Semana ISO |
| `estado` | texto | No | `BORRADOR`, `ENVIADO`, `APROBADO`, `RECHAZADO` o `BLOQUEADO` |
| `empleadoId` | UUID | No | Empleado concreto |
| `limite` | entero 1-200 | No | Por defecto 50 |

Orden: año descendente, semana descendente y código de empleado ascendente. No hay paginación por cursor: para rangos grandes, filtra por semana o reduce el límite.

```bash
curl -s -H "Authorization: Bearer $LEVIPARTE_API_KEY" \
  "$BASE/partes?isoYear=2026&isoWeek=43&estado=APROBADO&limite=100"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "3f1c6a2e-8f4b-4a59-9c1e-2b7d5a0c9e11",
      "empleadoId": "b0a1...",
      "empleadoCodigo": "E0007",
      "empleadoNombre": "Juan Maldacena",
      "isoYear": 2026,
      "isoWeek": 43,
      "weekStart": "2026-10-19",
      "estado": "APROBADO",
      "totalMinutos": 2400,
      "version": 4,
      "enviadoAt": "2026-10-23T15:10:00.000Z",
      "revisadoAt": "2026-10-24T08:02:11.000Z"
    }
  ]
}
```

La respuesta no incluye líneas de imputación ni desglose por proyecto. Para eso, usa los informes o amplía el contrato con un nuevo endpoint versionado.

### 3.2 `GET /proyectos`

Lista todos los proyectos de la empresa, activos e inactivos.

```json
{
  "success": true,
  "data": [
    {
      "id": "d4f2...",
      "codigo": "P-001",
      "nombre": "Rehabilitación Edificio Colón",
      "activo": true,
      "esAjuste": false
    }
  ]
}
```

`esAjuste: true` identifica el proyecto interno que absorbe horas no imputables. Exclúyelo de los cruces contra presupuesto y de los informes de obra.

### 3.3 `POST /imputaciones`

Crea o actualiza una imputación. Es la única escritura de la API.

Cabeceras:

```http
Authorization: Bearer lv_...
Content-Type: application/json
Idempotency-Key: 8f14e45fceea167a5a36dedd4bea2543
```

Cuerpo:

```json
{
  "empleadoId": "b0a1...",
  "fecha": "2026-10-23",
  "tareaId": "c7e9...",
  "minutos": 480
}
```

| Campo | Regla |
|-------|-------|
| `empleadoId` | UUID de un empleado de la misma empresa |
| `fecha` | Fecha ISO `YYYY-MM-DD` |
| `tareaId` | UUID de una tarea activa asignada al empleado en esa fecha |
| `minutos` | Entero entre 1 y 1440 |

Comportamiento:

- Busca el parte de la semana ISO de la fecha. Si no existe, crea un `BORRADOR` vacío.
- Solo admite escritura si el parte está en `BORRADOR` o `RECHAZADO`.
- Hace upsert por `(parte, fecha, tarea)`: repetir la misma terna con otros minutos actualiza la fila.
- Recalcula `total_minutos` en el servidor y sube `version`.
- Comprueba que el periodo no esté cerrado.
- No envía el parte, no aprueba y no calcula desviación, cómputo ni coste.

Respuesta `201`:

```json
{
  "success": true,
  "data": {
    "parteId": "3f1c...",
    "imputacionId": "9a2b...",
    "totalMinutos": 2400,
    "version": 5
  }
}
```

Errores habituales:

- `403 SIN_PERMISO` si la tarea no está asignada, está inactiva o es de otra empresa.
- `409 ESTADO_INVALIDO` si el parte está `ENVIADO`, `APROBADO` o `BLOQUEADO`, o si la fecha cae en un periodo cerrado.
- `422 VALIDACION` si `minutos` no es entero o está fuera de rango.

Limitación conocida: la escritura por API comprueba asignación, minutos y cierre, pero no valida que el día sea laborable según el calendario. Si tu integración puede enviar festivos o fines de semana, valídalo en origen.

### 3.4 `GET /openapi.json`

Describe el contrato de la API en OpenAPI 3.0, generado desde los mismos esquemas Zod que validan las peticiones. Es público, no requiere clave y se cachea 5 minutos.

```bash
curl -s "$BASE/openapi.json" | jq '.info'
```

Úsalo para generar clientes o para comprobar en cada despliegue que el contrato publicado coincide con el esperado. Si necesitas el documento fuera de línea, guárdalo en tu repositorio y compara.

## 4. Idempotencia

- `Idempotency-Key` es obligatoria en `POST /imputaciones`.
- Longitud: 8 a 128 caracteres después de `trim`.
- Ámbito: por clave de API y valor de la cabecera. No reutilices la misma clave para operaciones distintas aunque sean del mismo recurso.
- Primera petición: se reclama la clave y se procesa.
- Petición simultánea con la misma clave: `409 ESTADO_INVALIDO` con el mensaje de petición en curso.
- Petición repetida con respuesta guardada: se devuelve el mismo cuerpo y estado, con la cabecera `Idempotency-Replayed: true`.
- Si el procesamiento falla, la clave se libera para poder reintentar con el mismo valor.

Recomendación: usa un UUID v4 o un hash del contenido que quieras deduplicar. No uses un contador que se reinicie.

```bash
curl -s -X POST "$BASE/imputaciones" \
  -H "Authorization: Bearer $LEVIPARTE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"empleadoId":"b0a1...","fecha":"2026-10-23","tareaId":"c7e9...","minutos":480}'
```

## 5. Webhooks

Los webhooks se configuran en Administración > API: nombre, URL, eventos suscritos, activo y secreto. El secreto se genera al crear el webhook y se muestra una sola vez.

### 5.1 Eventos

| Evento | Cuándo |
|--------|--------|
| `parte.enviado` | El trabajador envía su parte |
| `parte.aprobado` | Un revisor lo aprueba |
| `parte.rechazado` | Un revisor lo rechaza con motivo |
| `parte.reabierto` | Un revisor lo devuelve a borrador |

No se emiten eventos al crear un borrador, guardar horas ni cerrar un periodo.

### 5.2 Cuerpo

```json
{
  "id": "6b2f7c1d-3a4e-4f80-b1c2-9d0e5a6f7b81",
  "evento": "parte.aprobado",
  "ocurridoEn": "2026-10-24T08:02:11.000Z",
  "datos": {
    "parteId": "3f1c6a2e-8f4b-4a59-9c1e-2b7d5a0c9e11",
    "empleadoId": "b0a1...",
    "isoYear": 2026,
    "isoWeek": 43,
    "estado": "APROBADO",
    "actorId": "e5c8...",
    "motivo": null
  }
}
```

- `id` identifica la entrega, no el evento de negocio. Un reintento reenvía el mismo `id`, el mismo cuerpo y la misma firma.
- `motivo` solo tiene contenido en `parte.rechazado` y `parte.reabierto`.
- `estado` refleja el estado resultante del parte.

### 5.3 Cabeceras y firma

```http
Content-Type: application/json
User-Agent: parte-diario-webhooks/1
X-Leviparte-Evento: parte.aprobado
X-Leviparte-Timestamp: 1761292931
X-Leviparte-Firma: 5f2c...
```

La firma es `HMAC-SHA256(secreto, "<timestamp>.<cuerpo>")` en hexadecimal. El cuerpo firmado es exactamente el texto recibido, sin reserializar.

Verificación en Node:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

const secreto = process.env.LEVIPARTE_WEBHOOK_SECRET ?? ''
const timestamp = Number(request.headers.get('x-leviparte-timestamp'))
const recibida = request.headers.get('x-leviparte-firma') ?? ''
const cuerpo = await request.text()

const esperada = createHmac('sha256', secreto).update(`${timestamp}.${cuerpo}`).digest('hex')

const ok =
  Math.abs(Date.now() / 1000 - timestamp) <= 300 &&
  esperada.length === recibida.length &&
  timingSafeEqual(Buffer.from(esperada), Buffer.from(recibida))
```

Reglas:

- Rechaza si el timestamp se desvía más de 300 segundos, para evitar reenvíos.
- Compara en tiempo constante.
- Verifica la firma antes de interpretar el JSON.
- Responde 2xx en menos de 10 segundos. El adaptador corta a los 10 segundos.
- Cualquier respuesta distinta de 2xx cuenta como fallo; el cuerpo de tu respuesta se ignora.

### 5.4 Reintentos

| Intento | Espera desde el fallo |
|---------|-----------------------|
| 1 | 1 minuto |
| 2 | 5 minutos |
| 3 | 15 minutos |
| 4 | 60 minutos |
| 5 | 240 minutos |

Después del quinto intento, la entrega pasa a `AGOTADO` y deja de reintentarse. Estados: `PENDIENTE`, `ENVIADO`, `FALLIDO`, `AGOTADO`. El despacho corre cada minuto en el worker y también puede forzarse por cron.

Un webhook caído no revierte la aprobación: el evento se escribe en `outbox` en la misma transacción del cambio de estado y se entrega después.

## 6. Endpoints de operación

No usan clave de API. Exigen `CRON_SECRET` en `Authorization: Bearer` o en `X-Cron-Secret`. Sin `CRON_SECRET`, responden 503.

### 6.1 `GET|POST /cron/avisos`

Genera avisos in-app y encola correos.

| Parámetro | Valores | Por defecto |
|-----------|---------|-------------|
| `modo` | `recordatorios`, `riesgos`, `todo` | `todo` |
| `ventana` | `viernes`, `lunes`, `manual` | `viernes` |
| `semana` | `actual`, `anterior` | `actual` |
| `dryRun` | `1`, `true`, `si` | Desactivado |

Devuelve `creadas`, `omitidas`, `emails`, el resumen de la semana y el lote generado. Es idempotente por usuario, tipo y periodo: repetirlo no duplica avisos ni correos.

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE/cron/avisos?modo=recordatorios&semana=actual&ventana=viernes"
```

### 6.2 `GET|POST /cron/webhooks`

Fuerza el despacho del outbox y de las entregas pendientes. Devuelve `outbox`, `enviadas`, `fallidas` y `agotadas`. Es útil para diagnóstico y para no esperar al minuto del worker.

### 6.3 `GET /cron/salud`

Sonda para el monitor externo. Devuelve 200 con `alerta: false` y 503 cuando hay cinco o más jobs fallidos en `pg-boss`. Si la cola no está iniciada, responde 200 con `cola: "no-iniciada"`.

## 7. Ejemplo completo

```bash
BASE="https://horas.levitec.marianorluna.com/api/v1"
KEY="lv_3f9a1c77b204_..."

# 1. Proyectos, para localizar el proyecto de ajuste y las obras activas
curl -s -H "Authorization: Bearer $KEY" "$BASE/proyectos"

# 2. Partes aprobados de la semana 43
curl -s -H "Authorization: Bearer $KEY" \
  "$BASE/partes?isoYear=2026&isoWeek=43&estado=APROBADO"

# 3. Imputar 8 horas, con reintento seguro
curl -s -X POST "$BASE/imputaciones" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 6f1d2c3b-4a59-4e80-9c1e-2b7d5a0c9e11" \
  -d '{"empleadoId":"b0a1...","fecha":"2026-10-23","tareaId":"c7e9...","minutos":480}'
```

Flujo recomendado para un ERP:

1. Sincroniza el catálogo de proyectos y tareas una vez al día.
2. Envía imputaciones con una clave de idempotencia estable por operación.
3. Escucha `parte.enviado` y `parte.aprobado` para actualizar tu estado.
4. Reintenta cualquier 5xx o timeout con la misma clave.
5. No reintentes un 4xx salvo `429`, que puedes reintentar tras esperar.

## 8. Buenas prácticas

- Una clave por integración y entorno; nunca compartas la de producción.
- Rota la clave si sospechas una filtración: crea otra, despliega el cambio y revoca la anterior.
- Guarda el secreto del webhook en tu gestor de secretos; no puedes recuperarlo desde LeviParte.
- Responde rápido al webhook y procesa después: tu latencia cuenta para el timeout de 10 segundos.
- Deduplica por `datos.parteId` y `evento` si tu sistema puede recibir el mismo evento por reintento.
- Respeta el límite de 60 por minuto y evita bucles de sondeo; usa webhooks para cambios.
- No uses la API para aprobar: esa decisión es humana y auditada.

## 9. Límites actuales

- Sin endpoint de líneas de imputación por parte.
- Sin filtro por proyecto en `GET /partes`.
- Sin paginación por cursor.
- Sin escritura de ausencias, calendario ni presupuesto.
- Sin eventos de cierre o reapertura de periodo.
- Sin validación de día laborable en `POST /imputaciones`.
- Sin API de administración de claves y webhooks: se gestionan desde la interfaz.
- El asistente de IA y las acciones de revisión (aprobar, rechazar, reabrir) son solo de interfaz y no forman parte de la API v1.

Estas limitaciones son deliberadas en v1. Cualquier ampliación debe entrar como contrato nuevo y documentarse aquí y en `openapi.json`.
