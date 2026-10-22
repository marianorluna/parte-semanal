# Onboarding - Setup local

Guía para levantar el proyecto desde cero.

Antes de usarla, sustituye los comandos y requisitos de ejemplo por los reales. Elimina secciones irrelevantes o marca «No aplica» (por ejemplo, BD o servidor en una biblioteca); los placeholders no son comandos ejecutables ni decisiones. Las versiones exactas y la resolución de dependencias se mantienen en los manifiestos, lockfiles y archivos de runtime del proyecto, no en listas duplicadas aquí.

## Stack y producto

- **Stack:** [`AGENTS.md` §2](../AGENTS.md#2-stack-del-proyecto)
- **Producto / dominio:** [`AGENTS.md` §3](../AGENTS.md#3-contexto-de-negocio)
- **Capas / carpetas:** [`docs/architecture.md`](./architecture.md)

---

## Requisitos previos

- [ ] [Instalar el runtime indicado en AGENTS.md y respetar el archivo de versión del proyecto, si existe]
- [ ] [Preparar el gestor de paquetes declarado por el proyecto]
- [ ] [Preparar la base de datos indicada en AGENTS.md, si aplica]
- [ ] [Preparar las herramientas de contenedores declaradas, si aplica]
- [ ] Acceso al repositorio en GitHub / GitLab

---

## 1. Clonar el repositorio

```bash
git clone [URL_DEL_REPO]
cd [NOMBRE_DEL_PROYECTO]
```

---

## 2. Variables de entorno

```bash
cp .env.example .env
```

Abre `.env`, descomenta y adapta solo las variables que necesite el proyecto. Obtén los secretos por el canal seguro del equipo o genéralos según los requisitos del mecanismo elegido; nunca reutilices un valor de ejemplo. Las variables públicas del frontend son visibles para el cliente y no deben contener secretos.

Comprueba que los archivos con secretos están excluidos y que las plantillas versionadas solo contienen ejemplos sin secretos. `.gitignore` no protege archivos ya versionados: ante una exposición, rota los secretos afectados.

---

## 3. Instalar dependencias

```bash
[npm install | pnpm install | yarn | pip install -r requirements.txt]
```

---

## 4. Base de datos

```bash
[npx prisma migrate dev | python manage.py migrate | otro]
```

---

## 5. Levantar el servidor de desarrollo

```bash
[npm run dev | pnpm dev | python main.py | otro]
```

La app debería estar disponible en `[http://localhost:PUERTO]`.

---

## 6. Verificar que todo funciona

Completa estos campos con comandos que existan en el proyecto; si la herramienta aún no está configurada, indica «Pendiente», sin inventar comandos ni instalarla implícitamente.

- **Lint:** [comando real o No aplica/Pendiente]
- **Formato (comprobación sin escritura):** [comando real o No aplica/Pendiente]
- **Tipado:** [comando real o No aplica/Pendiente]
- **Tests:** [comando real del runner declarado o No aplica/Pendiente]

- [ ] El punto de entrada del producto funciona (UI, CLI, biblioteca o servicio, según corresponda).
- [ ] Las verificaciones disponibles terminan correctamente; se identifican las pendientes o bloqueadas.
- [ ] El agente de Cursor aplica las reglas generales y las contextuales pertinentes; el idioma es una comprobación parcial, no prueba de toda la configuración.
- [ ] El flujo principal se comprueba con datos de prueba en un entorno local controlado, sin modificar servicios compartidos o producción.

---

## Solución de problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|---------------|---------|
| `Cannot find module` | Dependencias no instaladas | Ejecutar el paso 3 de nuevo |
| Error de conexión a BD | `.env` mal configurado o BD no levantada | Revisar `DATABASE_URL` y arrancar el servicio de BD |
| Puerto ocupado | Otro proceso usa el mismo puerto | Cambiar el puerto mediante la configuración del proyecto o identificar y detener solo un proceso propio que sea seguro parar |

---

## Contexto adicional

| Tema | Fuente |
|------|--------|
| Stack / producto | [`AGENTS.md`](../AGENTS.md) |
| Capas / carpetas / flujos | [`architecture.md`](./architecture.md) |
| Decisiones (ADRs) | [`decisions.md`](./decisions.md) |
| Guía de archivos / empieza aquí | [`start.md`](./start.md) |
