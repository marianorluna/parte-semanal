'use server'

import { revalidatePath } from 'next/cache'
import { autorizar } from '@/modules/identidad/application/sesion'
import { depsAvisos, depsPartes } from '@/composition'
import { aprobarSemana } from '@/modules/partes/application/servicio'
import { recordarPendientes } from '@/modules/notificaciones/application/servicio'
import { hoyEnZona, semanaIso } from '@/modules/partes/domain/fechas'
import { miembrosEquipo } from '@/modules/reporting/infrastructure/consultas'

export type ResultadoAccion = { ok: true; mensaje: string } | { ok: false; error: string }

const QUIEN_REVISA = ['ADMIN', 'ENCARGADO'] as const

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof Error) return { ok: false, error: error.message }
  console.error('[control/equipo]', error)
  return { ok: false, error: 'No se pudo completar la acción' }
}

export async function aprobarParteAction(input: {
  parteId: string
  version: number
  isoYear: number
  isoWeek: number
}): Promise<ResultadoAccion> {
  try {
    const usuario = await autorizar(...QUIEN_REVISA)
    await aprobarSemana(depsPartes, usuario, { parteId: input.parteId, version: input.version })
    revalidatePath('/control/equipo')
    revalidatePath('/control/partes')
    return { ok: true, mensaje: 'Parte aprobado' }
  } catch (error) {
    return aResultado(error)
  }
}

export async function aprobarEnviadosAction(input: {
  partes: { parteId: string; version: number }[]
  isoYear: number
  isoWeek: number
}): Promise<ResultadoAccion> {
  try {
    const usuario = await autorizar(...QUIEN_REVISA)
    let aprobados = 0
    let primerError: string | null = null

    for (const parte of input.partes) {
      try {
        await aprobarSemana(depsPartes, usuario, { parteId: parte.parteId, version: parte.version })
        aprobados += 1
      } catch (error) {
        if (!primerError) {
          primerError = error instanceof Error ? error.message : 'Error al aprobar el parte'
        }
      }
    }

    revalidatePath('/control/equipo')
    revalidatePath('/control/partes')

    if (aprobados === 0) {
      return { ok: false, error: primerError ?? 'No había partes pendientes de aprobar' }
    }
    return {
      ok: true,
      mensaje: `${aprobados} ${aprobados === 1 ? 'parte aprobado' : 'partes aprobados'}${primerError ? ' (alguno falló)' : ''}`,
    }
  } catch (error) {
    return aResultado(error)
  }
}

export async function recordarUsuariosAction(input: {
  usuarioIds: string[]
  isoYear: number
  isoWeek: number
}): Promise<ResultadoAccion> {
  try {
    const usuario = await autorizar(...QUIEN_REVISA)
    const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
    const semana = semanaIso(input.isoYear, input.isoWeek)

    // Solo se recuerda a quien el revisor puede ver en esta semana.
    const miembros = await miembrosEquipo(usuario.empresaId, semana, {
      encargadoUsuarioId: usuario.rol === 'ENCARGADO' ? usuario.id : null,
    })
    const permitidos = new Set(miembros.map((miembro) => miembro.usuarioId))
    const usuarioIds = input.usuarioIds.filter((id) => permitidos.has(id))

    if (usuarioIds.length === 0) {
      return { ok: false, error: 'No hay destinatarios válidos para el recordatorio' }
    }

    const resultado = await recordarPendientes(depsAvisos, {
      empresaId: usuario.empresaId,
      usuarioIds,
      semana,
      hoy,
    })

    revalidatePath('/control/equipo')
    revalidatePath('/notificaciones')

    if (resultado.creadas === 0) {
      return { ok: false, error: 'Esos recordatorios ya se enviaron hoy' }
    }

    return {
      ok: true,
      mensaje: `${resultado.creadas} ${resultado.creadas === 1 ? 'recordatorio enviado' : 'recordatorios enviados'}`,
    }
  } catch (error) {
    return aResultado(error)
  }
}
