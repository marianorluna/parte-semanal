import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/config/env'
import { depsAvisos } from '@/composition'
import {
  generarAvisos,
  type ModoAvisos,
  type OpcionesAvisos,
} from '@/modules/notificaciones/application/servicio'
import type { VentanaAviso } from '@/modules/notificaciones/domain/claves'
import { hoyEnZona, semanaIsoDe, sumarDias } from '@/modules/partes/domain/fechas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODOS: readonly ModoAvisos[] = ['recordatorios', 'riesgos', 'todo']
const VENTANAS: readonly VentanaAviso[] = ['viernes', 'lunes', 'manual']

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
 * Cron de avisos. Lo invoca Coolify o n8n. Devuelve el lote generado para que
 * un automatizador pueda reenviarlo por email o WhatsApp (ver ADR-009).
 *
 * GET/POST /api/v1/cron/avisos?modo=todo&semana=actual&ventana=viernes&dryRun=1
 */
async function ejecutar(request: NextRequest): Promise<NextResponse> {
  const secreto = env().CRON_SECRET
  if (!secreto) {
    return NextResponse.json(
      { ok: false, error: 'El cron de avisos no está configurado (CRON_SECRET)' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  if (!compararSeguro(tokenDe(request), secreto)) {
    return NextResponse.json(
      { ok: false, error: 'No autorizado' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const params = request.nextUrl.searchParams
  const modo = (params.get('modo') ?? 'todo') as ModoAvisos
  const ventana = (params.get('ventana') ?? 'viernes') as VentanaAviso
  const referencia = params.get('semana') ?? 'actual'
  const dryRun = ['1', 'true', 'si'].includes((params.get('dryRun') ?? '').toLowerCase())

  if (!MODOS.includes(modo)) {
    return NextResponse.json({ ok: false, error: 'modo no válido' }, { status: 400 })
  }
  if (!VENTANAS.includes(ventana)) {
    return NextResponse.json({ ok: false, error: 'ventana no válida' }, { status: 400 })
  }
  if (referencia !== 'actual' && referencia !== 'anterior') {
    return NextResponse.json({ ok: false, error: 'semana debe ser actual o anterior' }, { status: 400 })
  }

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaActual = semanaIsoDe(hoy)
  const semana =
    referencia === 'anterior' ? semanaIsoDe(sumarDias(semanaActual.weekStart, -7)) : semanaActual

  const opciones: OpcionesAvisos = { modo, ventana, semana, hoy, dryRun }

  try {
    const resultado = await generarAvisos(depsAvisos, opciones)
    console.info(
      `[cron/avisos] modo=${modo} ventana=${ventana} semana=${semana.isoYear}-W${semana.isoWeek} dryRun=${dryRun} creadas=${resultado.creadas} omitidas=${resultado.omitidas}`,
    )

    return NextResponse.json(
      {
        ok: true,
        modo,
        ventana,
        dryRun,
        hoy,
        semana: {
          isoYear: semana.isoYear,
          isoWeek: semana.isoWeek,
          weekStart: semana.weekStart,
          weekEnd: semana.weekEnd,
        },
        empresas: resultado.empresas,
        creadas: resultado.creadas,
        omitidas: resultado.omitidas,
        lote: resultado.lote,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[cron/avisos]', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudieron generar los avisos' },
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
