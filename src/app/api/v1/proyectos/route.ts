import type { NextRequest } from 'next/server'
import { depsIntegraciones } from '@/composition'
import { autenticarApi } from '@/modules/integraciones/application/servicio'
import { listarProyectosApi } from '@/modules/integraciones/infrastructure/consultas'
import { respuestaError, respuestaOk } from '../_lib/respuesta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const contexto = await autenticarApi(
      depsIntegraciones,
      request.headers.get('authorization'),
      'proyectos:leer',
    )

    return respuestaOk(await listarProyectosApi(contexto.empresaId))
  } catch (error) {
    return respuestaError(error)
  }
}
