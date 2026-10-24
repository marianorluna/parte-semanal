'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { depsInformes } from '@/composition'
import { reintentarInforme, solicitarInforme } from '@/modules/informes/application/servicio'
import {
  FORMATOS_INFORME,
  TIPOS_INFORME,
  type FormatoInforme,
  type TipoInforme,
} from '@/modules/informes/domain/informe'
import { AppError } from '@/shared/errors'

export type EstadoInformes = {
  error?: string
  ok?: string
  campo?: Record<string, string>
}

function aError(error: unknown): EstadoInformes {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[informes]', error)
  return { error: 'No se pudo completar la operación' }
}

function erroresDeZod(error: z.ZodError): EstadoInformes {
  const campo: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (clave && !campo[clave]) campo[clave] = issue.message
  }
  return { error: 'Revisa los campos marcados', campo }
}

const solicitudSchema = z.object({
  tipo: z.enum(TIPOS_INFORME),
  formato: z.enum(FORMATOS_INFORME),
})

export async function solicitarInformeAction(
  _prev: EstadoInformes,
  formData: FormData,
): Promise<EstadoInformes> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = solicitudSchema.safeParse({
      tipo: String(formData.get('tipo') ?? ''),
      formato: String(formData.get('formato') ?? 'XLSX'),
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const parametros = parametrosDeFormulario(parsed.data.tipo, formData)
    if (!parametros.ok) return { error: parametros.mensaje, campo: { [parametros.campo]: parametros.mensaje } }

    const id = await solicitarInforme(depsInformes, actor, {
      tipo: parsed.data.tipo as TipoInforme,
      formato: parsed.data.formato as FormatoInforme,
      parametros: parametros.parametros,
    })

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'informe',
      entidadId: id,
      accion: 'SOLICITAR_INFORME',
      despues: { tipo: parsed.data.tipo, formato: parsed.data.formato },
    })

    revalidatePath('/admin/informes')
    return { ok: 'Informe en cola. Aparecerá como listo en unos segundos.' }
  } catch (error) {
    return aError(error)
  }
}

type ParametrosLeidos =
  | { ok: true; parametros: Record<string, unknown> }
  | { ok: false; campo: string; mensaje: string }

function parametrosDeFormulario(tipo: TipoInforme, formData: FormData): ParametrosLeidos {
  if (tipo === 'CERTIFICACION_MENSUAL') {
    const anio = Number(formData.get('anio') ?? 0)
    const mes = Number(formData.get('mes') ?? 0)
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      return { ok: false, campo: 'anio', mensaje: 'Año no válido' }
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return { ok: false, campo: 'mes', mensaje: 'Mes no válido' }
    }
    return { ok: true, parametros: { anio, mes } }
  }

  const desde = String(formData.get('desde') ?? '')
  const hasta = String(formData.get('hasta') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return { ok: false, campo: 'desde', mensaje: 'Indica un rango de fechas válido' }
  }

  if (tipo === 'COSTES_PROYECTO') {
    const proyectoId = String(formData.get('proyectoId') ?? '').trim()
    return { ok: true, parametros: { desde, hasta, proyectoId: proyectoId || null } }
  }

  return { ok: true, parametros: { desde, hasta } }
}

export async function reintentarInformeAction(
  _prev: EstadoInformes,
  formData: FormData,
): Promise<EstadoInformes> {
  try {
    const actor = await autorizar('ADMIN')
    const informeId = String(formData.get('informeId') ?? '')
    if (!informeId) return { error: 'Informe no indicado' }

    await reintentarInforme(depsInformes, actor, informeId)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'informe',
      entidadId: informeId,
      accion: 'REINTENTAR_INFORME',
    })

    revalidatePath('/admin/informes')
    return { ok: 'Informe reencolado' }
  } catch (error) {
    return aError(error)
  }
}
