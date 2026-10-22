// Entrypoint del contenedor de producción.
//
// Se escribe en Node y no en shell a propósito: el repositorio se edita en
// Windows y un `#!/bin/sh` con finales de línea CRLF no arranca en Alpine.
//
// Responsabilidades:
//   1. Fallar rápido si falta una variable imprescindible.
//   2. Aplicar las migraciones pendientes (idempotentes) antes de servir.
//   3. Arrancar Next.js y reenviarle SIGTERM/SIGINT para un apagado limpio.

import { spawn } from 'node:child_process'

function abortar(mensaje) {
  console.error(`[entrypoint] ${mensaje}`)
  process.exit(1)
}

const databaseUrl = process.env.DATABASE_URL ?? ''
const authSecret = process.env.AUTH_SECRET ?? ''

if (!databaseUrl) {
  abortar('DATABASE_URL no está definida.')
}

if (authSecret.length < 32) {
  abortar('AUTH_SECRET debe tener al menos 32 caracteres. Genera uno con: openssl rand -base64 32')
}

function ejecutar(comando, argumentos) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(comando, argumentos, { stdio: 'inherit' })
    hijo.on('error', reject)
    hijo.on('exit', (codigo, senal) => {
      if (senal) reject(new Error(`terminado por la señal ${senal}`))
      else resolve(codigo ?? 1)
    })
  })
}

console.log('[entrypoint] aplicando migraciones pendientes')
const codigoMigracion = await ejecutar(process.execPath, ['scripts/migrate.mjs']).catch((error) => {
  console.error(`[entrypoint] no se pudieron aplicar las migraciones: ${error.message}`)
  process.exit(1)
})

if (codigoMigracion !== 0) {
  console.error(`[entrypoint] las migraciones fallaron con código ${codigoMigracion}`)
  process.exit(codigoMigracion)
}

console.log('[entrypoint] arrancando la aplicación')
const app = spawn(process.execPath, ['server.js'], { stdio: 'inherit' })

for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    app.kill(senal)
  })
}

app.on('error', (error) => {
  console.error(`[entrypoint] no se pudo arrancar la aplicación: ${error.message}`)
  process.exit(1)
})

app.on('exit', (codigo) => {
  process.exit(codigo ?? 0)
})
