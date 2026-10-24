import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/db/client'
import { env } from '@/config/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UMBRAL_JOBS_FALLIDOS = 5

function compararSeguro(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

function tokenDe(request: NextRequest): string {
  const cabecera = request.headers.get('authorization') ?? ''
  if (cabecera.toLowerCase().startsWith('bearer ')) return cabecera.slice(7).trim()
  return (request.headers.get('x-cron-secret') ?? '').trim()
}

type FilaCola = { tabla: string | null }
type FilaFallidos = { total: number }

/**
 * Sonda para el monitor externo: 503 cuando la cola acumula jobs fallidos por
 * encima del umbral, de forma que la alerta no dependa de mirar el health.
 * GET /api/v1/cron/salud con Bearer CRON_SECRET.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secreto = env().CRON_SECRET
  if (!secreto) {
    return NextResponse.json(
      { ok: false, error: 'La sonda de cola no está configurada (CRON_SECRET)' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  if (!compararSeguro(tokenDe(request), secreto)) {
    return NextResponse.json(
      { ok: false, error: 'No autorizado' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const tablas = (await sql`
      select to_regclass('pgboss.job')::text as tabla
    `) as unknown as FilaCola[]

    if (!tablas[0]?.tabla) {
      return NextResponse.json(
        { ok: true, cola: 'no-iniciada', jobsFallidos: 0, alerta: false },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const fallidos = (await sql`
      select count(*)::int as total
      from pgboss.job
      where state = 'failed'
    `) as unknown as FilaFallidos[]
    const jobsFallidos = fallidos[0]?.total ?? 0
    const alerta = jobsFallidos >= UMBRAL_JOBS_FALLIDOS

    return NextResponse.json(
      {
        ok: !alerta,
        cola: 'ok',
        jobsFallidos,
        umbral: UMBRAL_JOBS_FALLIDOS,
        alerta,
      },
      { status: alerta ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[cron/salud]', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudo consultar la cola' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
