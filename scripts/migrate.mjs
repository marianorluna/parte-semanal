import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(path.resolve('.env'))
  } catch {
    // En producción las variables llegan del entorno del contenedor.
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('[migrate] DATABASE_URL no está definida')
  process.exit(1)
}

const carpetaMigraciones = process.env.MIGRATIONS_DIR ?? './src/db/migrations'
const intentosMaximos = 30
const esperaMs = 3000

async function esperarBaseDeDatos() {
  for (let intento = 1; intento <= intentosMaximos; intento += 1) {
    const sql = postgres(url, { max: 1, connect_timeout: 5 })
    try {
      await sql`select 1`
      await sql.end({ timeout: 5 })
      return
    } catch (error) {
      await sql.end({ timeout: 5 }).catch(() => {})
      const mensaje = error instanceof Error ? error.message : String(error)
      console.log(`[migrate] base de datos no disponible (${intento}/${intentosMaximos}): ${mensaje}`)
      await new Promise((resolve) => setTimeout(resolve, esperaMs))
    }
  }
  throw new Error('[migrate] no se pudo conectar a la base de datos')
}

async function main() {
  await esperarBaseDeDatos()

  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await sql`
      create table if not exists migracion_aplicada (
        nombre text primary key,
        aplicada_en timestamptz not null default now()
      )
    `

    const archivos = (await readdir(carpetaMigraciones))
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b))

    if (archivos.length === 0) {
      console.log('[migrate] no hay migraciones pendientes')
      return
    }

    const aplicadas = await sql`select nombre from migracion_aplicada`
    const yaAplicadas = new Set(aplicadas.map((fila) => fila.nombre))

    for (const archivo of archivos) {
      if (yaAplicadas.has(archivo)) continue

      const contenido = await readFile(path.join(carpetaMigraciones, archivo), 'utf8')
      const sentencias = contenido
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      await sql.begin(async (tx) => {
        for (const sentencia of sentencias) {
          await tx.unsafe(sentencia)
        }
        await tx`insert into migracion_aplicada (nombre) values (${archivo})`
      })

      console.log(`[migrate] aplicada ${archivo}`)
    }

    console.log('[migrate] migraciones al día')
  } finally {
    await sql.end({ timeout: 10 })
  }
}

main().catch((error) => {
  console.error('[migrate] error:', error)
  process.exit(1)
})
