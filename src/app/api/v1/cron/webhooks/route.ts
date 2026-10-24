import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/config/env'
import { depsIntegraciones } from '@/composition'
import { despacharWebhooks } from '@/modules/integraciones/application/servicio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

/**
 * Despacho manual de outbox y reintentos. El worker lo ejecuta cada minuto;
 * este endpoint existe para operación y diagnóstico.
 */
async function ejecutar(request: NextRequest): Promise<NextResponse> {
  const secreto = env().CRON_SECRET
  if (!secreto) {
    return NextResponse.json(
      { ok: false, error: 'El despacho de webhooks no está configurado (CRON_SECRET)' },
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
    const resumen = await despacharWebhooks(depsIntegraciones)
    return NextResponse.json(
      { ok: true, ...resumen },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[cron/webhooks]', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudieron despachar los webhooks' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return ejecutar(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return ejecutar(request)
}
