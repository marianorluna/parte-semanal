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
servicio `db` porque la app corre con `npm run dev`:

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
host: es el proxy de Coolify el que la publica en producción.

---

## 5. Levantar el servidor de desarrollo

```bash
npm run dev
```

La app queda en `http://localhost:3000`. `/api/health` responde `{"status":"ok","database":"ok"}` cuando la base de datos está accesible.

### Cuentas del demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| ADMIN | `admin@demo.local` | `Demo1234!` (o `DEMO_PASSWORD`) |
| ENCARGADO | `encargado1@demo.local` ... `encargado6@demo.local` | igual |
| TRABAJADOR | `trabajador01@demo.local` ... `trabajador43@demo.local` | igual |

---

## 6. Verificar que todo funciona

```bash
npm run lint
npm run typecheck
npm run test
```

- [ ] `/api/health` devuelve 200 con `database: ok`.
- [ ] El login de un trabajador demo abre `/mi-semana` con la semana actual y asignaciones.
- [ ] El login de un encargado muestra partes enviados en `/control/partes`.
- [ ] `npm run db:seed:demo` dos veces seguidas no duplica filas.
- [ ] `npm run db:seed:demo:purge` deja la base sin filas `DEMO` y conserva otras empresas.

---

## Solución de problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| `Cannot find module` | Dependencias no instaladas | Ejecutar el paso 3 de nuevo |
| Error de conexión a BD | `.env` mal configurado o contenedor parado | Revisar `DATABASE_URL` y `docker compose up -d db` |
| `AUTH_SECRET` ausente | Falta la variable | Generarla con `openssl rand -base64 32` |
| Puerto 3000 o 5432 ocupado | Otro proceso usa el puerto | Parar solo el proceso propio que sea seguro parar o cambiar el puerto |
| El demo no aparece en el dashboard | Semanas antiguas cargadas | `npm run db:seed:demo -- --refresh` |

---

## Contexto adicional

| Tema | Fuente |
|------|--------|
| Stack / producto | [`AGENTS.md`](../AGENTS.md) |
| Capas / carpetas / flujos | [`architecture.md`](./architecture.md) |
| Decisiones (ADRs) | [`decisions.md`](./decisions.md) |
| Guía de archivos / empieza aquí | [`start.md`](./start.md) |
