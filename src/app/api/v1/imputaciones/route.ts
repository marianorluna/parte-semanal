import type { NextRequest } from 'next/server'
import { depsCierre, depsIntegraciones } from '@/composition'
import {
  autenticarApi,
  guardarRespuestaIdempotencia,
  liberarIdempotencia,
  reclamarIdempotencia,
} from '@/modules/integraciones/application/servicio'
import { imputacionBody } from '@/modules/integraciones/application/esquema'
import { empleadoDeEmpresa } from '@/modules/integraciones/infrastructure/consultas'
import { fechasBloqueadas, mensajePeriodoCerrado } from '@/modules/cierre/application/servicio'
import { AppError, ok } from '@/shared/errors'
import { respuestaError, respuestaGuardada, respuestaOk } from '../_lib/respuesta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function leerCuerpo(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AppError('VALIDACION', 'El cuerpo de la petición debe ser JSON válido')
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let reclamoId: string | null = null

  try {
    const contexto = await autenticarApi(
      depsIntegraciones,
      request.headers.get('authorization'),
      'imputaciones:escribir',
    )

    const claveIdempotencia = (request.headers.get('idempotency-key') ?? '').trim()
    const reclamo = await reclamarIdempotencia(depsIntegraciones, {
      apiKeyId: contexto.apiKeyId,
      clave: claveIdempotencia,
      metodo: 'POST',
      ruta: '/api/v1/imputaciones',
    })

    if (!reclamo.reclamada) {
      if (reclamo.respuesta !== null) return respuestaGuardada(reclamo.respuesta)
      throw new AppError(
        'ESTADO_INVALIDO',
        'Hay una petición en curso con la misma Idempotency-Key',
      )
    }
    reclamoId = reclamo.id

    const parsed = imputacionBody.safeParse(await leerCuerpo(request))
    if (!parsed.success) {
      const campo: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const clave = issue.path.join('.')
        if (clave && !campo[clave]) campo[clave] = issue.message
      }
      throw new AppError('VALIDACION', 'Revisa los campos de la imputación', campo)
    }

    const datos = parsed.data
    if (!(await empleadoDeEmpresa(contexto.empresaId, datos.empleadoId))) {
      throw new AppError('NO_ENCONTRADO', 'El empleado no existe en la empresa')
    }

    const cerradas = await fechasBloqueadas(
      depsCierre,
      contexto.empresaId,
      datos.empleadoId,
      datos.fecha,
      datos.fecha,
    )
    if (cerradas.length > 0) {
      throw new AppError('ESTADO_INVALIDO', mensajePeriodoCerrado(cerradas))
    }

    const resultado = await depsIntegraciones.repo.escribirImputacion({
      empresaId: contexto.empresaId,
      empleadoId: datos.empleadoId,
      fecha: datos.fecha,
      tareaId: datos.tareaId,
      minutos: datos.minutos,
    })

    await guardarRespuestaIdempotencia(depsIntegraciones, reclamo.id, {
      status: 201,
      body: ok(resultado),
    })
    reclamoId = null

    return respuestaOk(resultado, 201)
  } catch (error) {
    if (reclamoId) {
      await liberarIdempotencia(depsIntegraciones, reclamoId).catch((liberarError: unknown) => {
        console.error('[api/imputaciones] no se pudo liberar la idempotencia', liberarError)
      })
    }
    return respuestaError(error)
  }
}
