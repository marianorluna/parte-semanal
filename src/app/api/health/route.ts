import { NextResponse } from 'next/server'
import { sql } from '@/db/client'

export const dynamic = 'force-dynamic'

type FilaCola = { tabla: string | null }
type FilaFallidos = { total: number }

/**
 * Sonda de Coolify: 200 mientras la base de datos responda. La cola se informa
 * como `degraded` sin tumbar el contenedor: un job fallido se reintenta y no
 * debe provocar un reinicio en bucle de la aplicación.
 */
export async function GET() {
  try {
    await sql`select 1`
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'unreachable', cola: 'unreachable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  let cola: 'ok' | 'no-iniciada' | 'unreachable' = 'ok'
  let jobsFallidos = 0

  try {
    const tablas = (await sql`
      select to_regclass('pgboss.job')::text as tabla
    `) as unknown as FilaCola[]

    if (!tablas[0]?.tabla) {
      cola = 'no-iniciada'
    } else {
      const fallidos = (await sql`
        select count(*)::int as total
        from pgboss.job
        where state = 'failed'
      `) as unknown as FilaFallidos[]
      jobsFallidos = fallidos[0]?.total ?? 0
    }
  } catch {
    cola = 'unreachable'
  }

  const degradada = cola === 'unreachable' || jobsFallidos > 0

  return NextResponse.json(
    {
      status: degradada ? 'degraded' : 'ok',
      database: 'ok',
      cola,
      jobsFallidos,
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
