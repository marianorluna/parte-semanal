'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { depsAusencias } from '@/composition'
import {
  actualizarTipo,
  alternarTipo,
  crearTipo,
  guardarSaldo,
} from '@/modules/ausencias/application/servicio'
import { AppError } from '@/shared/errors'

export type EstadoAdminAusencias = {
  error?: string
  ok?: string
  campo?: Record<string, string>
}

function aError(error: unknown): EstadoAdminAusencias {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[admin/ausencias]', error)
  return { error: 'No se pudo completar la operación' }
}

function erroresDeZod(error: z.ZodError): EstadoAdminAusencias {
  const campo: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (clave && !campo[clave]) campo[clave] = issue.message
  }
  return { error: 'Revisa los campos marcados', campo }
}

/** Horas decimales a minutos enteros. */
function minutosDeHoras(valor: FormDataEntryValue | null): number | null {
  if (valor === null) return null
  const texto = String(valor).trim().replace(',', '.')
  if (texto === '') return null
  const horas = Number(texto)
  if (!Number.isFinite(horas) || horas < 0) return null
  return Math.round(horas * 60)
}

const tipoSchema = z.object({
  codigo: z.string().trim().min(2, 'Código obligatorio').max(30),
  nombre: z.string().trim().min(3, 'Nombre obligatorio').max(120),
  computaSaldo: z.boolean(),
  requiereAprobacion: z.boolean(),
})

function leerTipo(formData: FormData) {
  return tipoSchema.safeParse({
    codigo: String(formData.get('codigo') ?? ''),
    nombre: String(formData.get('nombre') ?? ''),
    computaSaldo: formData.get('computaSaldo') === 'on',
    requiereAprobacion: formData.get('requiereAprobacion') === 'on',
  })
}

export async function crearTipoAusenciaAction(
  _prev: EstadoAdminAusencias,
  formData: FormData,
): Promise<EstadoAdminAusencias> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = leerTipo(formData)
    if (!parsed.success) return erroresDeZod(parsed.error)

    const id = await crearTipo(depsAusencias, actor, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'tipo_ausencia',
      entidadId: id,
      accion: 'CREAR_TIPO_AUSENCIA',
      despues: parsed.data,
    })

    revalidatePath('/admin/ausencias')
    revalidatePath('/mis-ausencias')
    return { ok: 'Tipo de ausencia creado' }
  } catch (error) {
    return aError(error)
  }
}

export async function actualizarTipoAusenciaAction(
  _prev: EstadoAdminAusencias,
  formData: FormData,
): Promise<EstadoAdminAusencias> {
  try {
    const actor = await autorizar('ADMIN')
    const tipoId = String(formData.get('tipoId') ?? '')
    if (!tipoId) return { error: 'Tipo no indicado' }

    const parsed = leerTipo(formData)
    if (!parsed.success) return erroresDeZod(parsed.error)

    await actualizarTipo(depsAusencias, actor, tipoId, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'tipo_ausencia',
      entidadId: tipoId,
      accion: 'EDITAR_TIPO_AUSENCIA',
      despues: parsed.data,
    })

    revalidatePath('/admin/ausencias')
    return { ok: 'Tipo actualizado' }
  } catch (error) {
    return aError(error)
  }
}

export async function alternarTipoAusenciaAction(
  _prev: EstadoAdminAusencias,
  formData: FormData,
): Promise<EstadoAdminAusencias> {
  try {
    const actor = await autorizar('ADMIN')
    const tipoId = String(formData.get('tipoId') ?? '')
    const activo = formData.get('activo') === 'true'
    if (!tipoId) return { error: 'Tipo no indicado' }

    await alternarTipo(depsAusencias, actor, tipoId, activo)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'tipo_ausencia',
      entidadId: tipoId,
      accion: activo ? 'ACTIVAR_TIPO_AUSENCIA' : 'DESACTIVAR_TIPO_AUSENCIA',
    })

    revalidatePath('/admin/ausencias')
    revalidatePath('/mis-ausencias')
    return { ok: activo ? 'Tipo activado' : 'Tipo desactivado' }
  } catch (error) {
    return aError(error)
  }
}

const saldoSchema = z.object({
  empleadoId: z.string().uuid('Selecciona un empleado'),
  anio: z.number().int().min(2000).max(2100),
  minutosAsignados: z.number().int().min(0).max(100_000),
  minutosArrastrados: z.number().int().min(0).max(100_000),
})

export async function guardarSaldoAction(
  _prev: EstadoAdminAusencias,
  formData: FormData,
): Promise<EstadoAdminAusencias> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = saldoSchema.safeParse({
      empleadoId: formData.get('empleadoId'),
      anio: Number(formData.get('anio')),
      minutosAsignados: minutosDeHoras(formData.get('horasAsignadas')) ?? 0,
      minutosArrastrados: minutosDeHoras(formData.get('horasArrastradas')) ?? 0,
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    await guardarSaldo(depsAusencias, actor, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'saldo_vacaciones',
      entidadId: `${parsed.data.empleadoId}-${parsed.data.anio}`,
      accion: 'GUARDAR_SALDO_VACACIONES',
      despues: parsed.data,
    })

    revalidatePath('/admin/ausencias')
    revalidatePath('/mis-ausencias')
    return { ok: 'Saldo guardado' }
  } catch (error) {
    return aError(error)
  }
}
