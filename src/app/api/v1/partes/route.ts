import type { NextRequest } from 'next/server'
import { depsIntegraciones } from '@/composition'
import { autenticarApi } from '@/modules/integraciones/application/servicio'
import { listaPartesQuery } from '@/modules/integraciones/application/esquema'
import { listarPartesApi } from '@/modules/integraciones/infrastructure/consultas'
import { AppError } from '@/shared/errors'
import { respuestaError, respuestaOk } from '../_lib/respuesta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const contexto = await autenticarApi(
      depsIntegraciones,
      request.headers.get('authorization'),
      'partes:leer',
    )

    const crudos: Record<string, string> = {}
    for (const [clave, valor] of request.nextUrl.searchParams) {
      if (valor !== '') crudos[clave] = valor
    }

    const parsed = listaPartesQuery.safeParse(crudos)
    if (!parsed.success) {
      const campo: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const clave = issue.path.join('.')
        if (clave && !campo[clave]) campo[clave] = issue.message
      }
      throw new AppError('VALIDACION', 'Parámetros no válidos', campo)
    }

    const filas = await listarPartesApi(contexto.empresaId, parsed.data)
    return respuestaOk(filas)
  } catch (error) {
    return respuestaError(error)
  }
}
