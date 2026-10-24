'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { depsComputo } from '@/composition'
import {
  actualizarConvenio,
  alternarConvenio,
  asignarEmpleadoAConvenio,
  crearConvenio,
  eliminarRegla,
  guardarRegla,
  quitarAsignacion,
} from '@/modules/computo/application/servicio'
import { TIPOS_HORA, type AplicaEn, type TipoHora } from '@/modules/computo/domain/reglas'
import { AppError } from '@/shared/errors'

export type EstadoConvenio = {
  error?: string
  ok?: string
  campo?: Record<string, string>
}

function aError(error: unknown): EstadoConvenio {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[admin/convenios]', error)
  return { error: 'No se pudo completar la operación' }
}

function erroresDeZod(error: z.ZodError): EstadoConvenio {
  const campo: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (clave && !campo[clave]) campo[clave] = issue.message
  }
  return { error: 'Revisa los campos marcados', campo }
}

/** Convierte horas decimales a minutos enteros; null cuando el campo está vacío. */
function minutosDeHoras(valor: FormDataEntryValue | null): number | null {
  if (valor === null) return null
  const texto = String(valor).trim().replace(',', '.')
  if (texto === '') return null
  const horas = Number(texto)
  if (!Number.isFinite(horas) || horas < 0) return null
  return Math.round(horas * 60)
}

/** Convierte el factor decimal del formulario a puntos básicos enteros. */
function factorDeTexto(valor: FormDataEntryValue | null): number | null {
  if (valor === null) return null
  const texto = String(valor).trim().replace(',', '.')
  if (texto === '') return null
  const factor = Number(texto)
  if (!Number.isFinite(factor)) return null
  return Math.round(factor * 10_000)
}

const convenioSchema = z.object({
  codigo: z.string().trim().min(2, 'Código obligatorio').max(30),
  nombre: z.string().trim().min(3, 'Nombre obligatorio').max(120),
})

export async function crearConvenioAction(
  _prev: EstadoConvenio,
  formData: FormData,
): Promise<EstadoConvenio> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = convenioSchema.safeParse({
      codigo: String(formData.get('codigo') ?? ''),
      nombre: String(formData.get('nombre') ?? ''),
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const id = await crearConvenio(depsComputo, actor, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'convenio',
      entidadId: id,
      accion: 'CREAR_CONVENIO',
      despues: parsed.data,
    })

    revalidatePath('/admin/convenios')
    return { ok: 'Convenio creado' }
  } catch (error) {
    return aError(error)
  }
}

export async function actualizarConvenioAction(
  _prev: EstadoConvenio,
  formData: FormData,
): Promise<EstadoConvenio> {
  try {
    const actor = await autorizar('ADMIN')
    const convenioId = String(formData.get('convenioId') ?? '')
    if (!convenioId) return { error: 'Convenio no indicado' }

    const parsed = convenioSchema.safeParse({
      codigo: String(formData.get('codigo') ?? ''),
      nombre: String(formData.get('nombre') ?? ''),
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const version = await actualizarConvenio(depsComputo, actor, convenioId, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'convenio',
      entidadId: convenioId,
      accion: 'EDITAR_CONVENIO',
      despues: { ...parsed.data, version },
    })

    revalidatePath('/admin/convenios')
    return { ok: 'Convenio actualizado' }
  } catch (error) {
    return aError(error)
  }
}

export async function alternarConvenioAction(
  _prev: EstadoConvenio,
  formData: FormData,
): Promise<EstadoConvenio> {
  try {
    const actor = await autorizar('ADMIN')
    const convenioId = String(formData.get('convenioId') ?? '')
    const activo = formData.get('activo') === 'true'
    if (!convenioId) return { error: 'Convenio no indicado' }

    await alternarConvenio(depsComputo, actor, convenioId, activo)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'convenio',
      entidadId: convenioId,
      accion: activo ? 'ACTIVAR_CONVENIO' : 'DESACTIVAR_CONVENIO',
    })

    revalidatePath('/admin/convenios')
    return { ok: activo ? 'Convenio activado' : 'Convenio desactivado' }
  } catch (error) {
    return aError(error)
  }
}

const reglaSchema = z.object({
  tipoHora: z.enum(TIPOS_HORA),
  factorBps: z.number().int().min(0).max(100_000),
  aplicaEn: z.enum(['TODO', 'LABORABLE', 'FESTIVO']),
  topeDiarioMin: z.number().int().min(1).max(1440).nullable(),
  topeSemanalMin: z.number().int().min(1).max(10_080).nullable(),
  requiereAutorizacion: z.boolean(),
  prioridad: z.number().int().min(0).max(10_000),
})

export async function guardarReglaAction(
  _prev: EstadoConvenio,
  formData: FormData,
): Promise<EstadoConvenio> {
  try {
    const actor = await autorizar('ADMIN')
    const convenioId = String(formData.get('convenioId') ?? '')
    if (!convenioId) return { error: 'Convenio no indicado' }

    const parsed = reglaSchema.safeParse({
      tipoHora: String(formData.get('tipoHora') ?? 'NORMAL'),
      factorBps: factorDeTexto(formData.get('factor')) ?? -1,
      aplicaEn: String(formData.get('aplicaEn') ?? 'TODO'),
      topeDiarioMin: minutosDeHoras(formData.get('topeDiario')),
      topeSemanalMin: minutosDeHoras(formData.get('topeSemanal')),
      requiereAutorizacion: formData.get('requiereAutorizacion') === 'on',
      prioridad: Number(formData.get('prioridad') ?? 100),
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    await guardarRegla(depsComputo, actor, convenioId, {
      ...parsed.data,
      tipoHora: parsed.data.tipoHora as TipoHora,
      aplicaEn: parsed.data.aplicaEn as AplicaEn,
    })
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'regla_computo',
      entidadId: convenioId,
      accion: 'GUARDAR_REGLA',
      despues: parsed.data,
    })

    revalidatePath('/admin/convenios')
    return { ok: 'Regla guardada' }
  } catch (error) {
    return aError(error)
  }
}

export async function eliminarReglaAction(
  _prev: EstadoConvenio,
  formData: FormData,
): Promise<EstadoConvenio> {
  try {
    const actor = await autorizar('ADMIN')
    const convenioId = String(formData.get('convenioId') ?? '')
    const reglaId = String(formData.get('reglaId') ?? '')
    if (!convenioId || !reglaId) return { error: 'Regla no indicada' }

    await eliminarRegla(depsComputo, actor, convenioId, reglaId)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'regla_computo',
      entidadId: reglaId,
      accion: 'ELIMINAR_REGLA',
      antes: { convenioId },
    })

    revalidatePath('/admin/convenios')
    return { ok: 'Regla eliminada. Los partes cerrados conservan su resultado.' }
  } catch (error) {
    return aError(error)
  }
}

export async function asignarConvenioAction(
  _prev: EstadoConvenio,
  formData: FormData,
): Promise<EstadoConvenio> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = z
      .object({
        convenioId: z.string().uuid(),
        empleadoId: z.string().uuid('Selecciona un empleado'),
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
      })
      .safeParse({
        convenioId: formData.get('convenioId'),
        empleadoId: formData.get('empleadoId'),
        desde: String(formData.get('desde') ?? ''),
      })
    if (!parsed.success) return erroresDeZod(parsed.error)

    await asignarEmpleadoAConvenio(
      depsComputo,
      actor,
      parsed.data.convenioId,
      parsed.data.empleadoId,
      parsed.data.desde,
    )
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'empleado_convenio',
      entidadId: parsed.data.empleadoId,
      accion: 'ASIGNAR_CONVENIO',
      despues: parsed.data,
    })

    revalidatePath('/admin/convenios')
    return { ok: 'Convenio asignado' }
  } catch (error) {
    return aError(error)
  }
}

export async function quitarAsignacionConvenioAction(
  _prev: EstadoConvenio,
  formData: FormData,
): Promise<EstadoConvenio> {
  try {
    const actor = await autorizar('ADMIN')
    const asignacionId = String(formData.get('asignacionId') ?? '')
    if (!asignacionId) return { error: 'Asignación no indicada' }

    await quitarAsignacion(depsComputo, actor, asignacionId)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'empleado_convenio',
      entidadId: asignacionId,
      accion: 'QUITAR_ASIGNACION_CONVENIO',
    })

    revalidatePath('/admin/convenios')
    return { ok: 'Asignación eliminada' }
  } catch (error) {
    return aError(error)
  }
}
