import type { PgBoss } from 'pg-boss'

/**
 * Cola de trabajos sobre la misma base de datos (ADR-007). El cliente se crea
 * una sola vez por proceso y se comparte entre la web y el worker. La importación
 * de `pg-boss` es dinámica para no cargarlo en rutas que no encolan nada.
 */
export const COLA_INFORMES = 'informes'
export const COLA_LIMPIEZA_INFORMES = 'limpieza-informes'
export const COLA_EMAILS = 'emails'
export const COLA_WEBHOOKS = 'webhooks'

type Instancia = {
  boss: PgBoss
  conexion: string
}

let instancia: Promise<Instancia> | null = null

function conexion(): string {
  const url = process.env.DATABASE_URL ?? ''
  if (!url) throw new Error('DATABASE_URL no está definida: no se puede usar la cola de informes')
  return url
}

async function crear(connectionString: string): Promise<Instancia> {
  const { PgBoss: PgBossClass } = await import('pg-boss')
  const boss = new PgBossClass({
    connectionString,
    schema: 'pgboss',
    max: 4,
    application_name: 'parte-diario',
  })

  boss.on('error', (error: Error) => {
    console.error('[pg-boss]', error.message)
  })

  await boss.start()
  await boss.createQueue(COLA_INFORMES, {
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 15 * 60,
    deleteAfterSeconds: 24 * 60 * 60,
  })
  await boss.createQueue(COLA_LIMPIEZA_INFORMES, {
    retryLimit: 1,
    deleteAfterSeconds: 24 * 60 * 60,
  })
  await boss.createQueue(COLA_EMAILS, {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 2 * 60,
    deleteAfterSeconds: 7 * 24 * 60 * 60,
  })
  await boss.createQueue(COLA_WEBHOOKS, {
    retryLimit: 1,
    deleteAfterSeconds: 24 * 60 * 60,
  })

  return { boss, conexion: connectionString }
}

export function bossCompartido(): Promise<Instancia> {
  const actual = instancia
  if (actual) return actual

  const connectionString = conexion()
  const creada = crear(connectionString).catch((error: unknown) => {
    instancia = null
    throw error
  })
  instancia = creada
  return creada
}

export async function encolarInforme(informeId: string): Promise<string | null> {
  const { boss } = await bossCompartido()
  return boss.send(COLA_INFORMES, { informeId })
}

export async function encolarEmail(emailId: string): Promise<string | null> {
  const { boss } = await bossCompartido()
  return boss.send(COLA_EMAILS, { emailId })
}

export async function detenerCola(): Promise<void> {
  if (!instancia) return
  const { boss } = await instancia
  instancia = null
  await boss.stop({ graceful: true, timeout: 30_000 })
}
