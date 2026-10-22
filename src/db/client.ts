import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { env } from '@/config/env'

const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>
}

function crearCliente() {
  const sql = postgres(env().DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.__sql = sql
  }

  return sql
}

const sql = globalForDb.__sql ?? crearCliente()

export const db = drizzle(sql, { schema })
export { sql }
export type Db = typeof db
