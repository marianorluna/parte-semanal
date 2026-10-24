/**
 * Respuestas uniformes de /api/v1. Los errores de dominio se traducen a su
 * código HTTP y nunca exponen trazas.
 */

import { NextResponse } from 'next/server'
import { fallo, ok, type Respuesta } from '@/shared/errors'

const CABECERAS = { 'Cache-Control': 'no-store' }

export function respuestaOk<T>(
  data: T,
  status = 200,
  cabeceras: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(ok(data), {
    status,
    headers: { ...CABECERAS, ...cabeceras },
  })
}

export function respuestaError(error: unknown): NextResponse {
  const cuerpo: Respuesta<never> = fallo(error)
  const status = cuerpo.error.code === 'ERROR_INTERNO' ? 500 : estadoDe(cuerpo.error.code)
  return NextResponse.json(cuerpo, { status, headers: CABECERAS })
}

function estadoDe(codigo: string): number {
  switch (codigo) {
    case 'NO_AUTENTICADO':
      return 401
    case 'SIN_PERMISO':
      return 403
    case 'NO_ENCONTRADO':
      return 404
    case 'VALIDACION':
      return 422
    case 'ESTADO_INVALIDO':
    case 'CONFLICTO_VERSION':
      return 409
    case 'DEMASIADAS_PETICIONES':
      return 429
    default:
      return 500
  }
}

export function respuestaGuardada(valor: unknown): NextResponse {
  const guardada = valor as { status?: number; body?: unknown }
  const status = typeof guardada.status === 'number' ? guardada.status : 200
  return NextResponse.json(guardada.body ?? valor, {
    status,
    headers: { ...CABECERAS, 'Idempotency-Replayed': 'true' },
  })
}
