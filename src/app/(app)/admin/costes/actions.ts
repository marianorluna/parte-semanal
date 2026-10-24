'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { depsCoste } from '@/composition'
import {
  actualizarTarifa,
  costearParte,
  crearPresupuesto,
  crearTarifa,
  eliminarTarifa,
} from '@/modules/coste/application/servicio'
import { eurosACentimos } from '@/modules/coste/domain/coste'
import { AppError } from '@/shared/errors'

export type EstadoCoste = {
  error?: string
  ok?: string
  campo?: Record<string, string>
}

function aError(error: unknown): EstadoCoste {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[admin/costes]', error)
  return { error: 'No se pudo completar la operación' }
}

function erroresDeZod(error: z.ZodError): EstadoCoste {
  const campo: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (clave && !campo[clave]) campo[clave] = issue.message
  }
  return { error: 'Revisa los campos marcados', campo }
}

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

const tarifaSchema = z.object({
  ambito: z.enum(['EMPLEADO', 'CATEGORIA']),
  empleadoId: z.string().uuid().nullable(),
  categoria: z.string().trim().min(2, 'Indica la categoría').max(80).nullable(),
  importeHoraCents: z.number().int().min(0).max(100_000_000),
  desde: fechaSchema,
  hasta: fechaSchema.nullable(),
  activo: z.boolean(),
})

function leerTarifa(formData: FormData) {
  const ambito = formData.get('ambito') === 'CATEGORIA' ? 'CATEGORIA' : 'EMPLEADO'
  const empleadoId = String(formData.get('empleadoId') ?? '').trim()
  const categoria = String(formData.get('categoria') ?? '').trim()
  const hasta = String(formData.get('hasta') ?? '').trim()

  return tarifaSchema.safeParse({
    ambito,
    empleadoId: ambito === 'EMPLEADO' && empleadoId ? empleadoId : null,
    categoria: ambito === 'CATEGORIA' && categoria ? categoria : null,
    importeHoraCents: eurosACentimos(String(formData.get('importe') ?? '')) ?? -1,
    desde: String(formData.get('desde') ?? ''),
    hasta: hasta === '' ? null : hasta,
    activo: formData.get('activo') === 'on',
  })
}

export async function crearTarifaAction(
  _prev: EstadoCoste,
  formData: FormData,
): Promise<EstadoCoste> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = leerTarifa(formData)
    if (!parsed.success) return erroresDeZod(parsed.error)
    if (parsed.data.ambito === 'EMPLEADO' && !parsed.data.empleadoId) {
      return { error: 'Selecciona un empleado', campo: { empleadoId: 'Empleado obligatorio' } }
    }

    const id = await crearTarifa(depsCoste, actor, {
      empleadoId: parsed.data.empleadoId,
      categoria: parsed.data.categoria,
      importeHoraCents: parsed.data.importeHoraCents,
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
      activo: parsed.data.activo,
    })

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'coste_hora',
      entidadId: id,
      accion: 'CREAR_TARIFA',
      despues: parsed.data,
    })

    revalidatePath('/admin/costes')
    return { ok: 'Tarifa creada' }
  } catch (error) {
    return aError(error)
  }
}

export async function actualizarTarifaAction(
  _prev: EstadoCoste,
  formData: FormData,
): Promise<EstadoCoste> {
  try {
    const actor = await autorizar('ADMIN')
    const tarifaId = String(formData.get('tarifaId') ?? '')
    if (!tarifaId) return { error: 'Tarifa no indicada' }

    const parsed = leerTarifa(formData)
    if (!parsed.success) return erroresDeZod(parsed.error)

    await actualizarTarifa(depsCoste, actor, tarifaId, {
      empleadoId: parsed.data.empleadoId,
      categoria: parsed.data.categoria,
      importeHoraCents: parsed.data.importeHoraCents,
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
      activo: parsed.data.activo,
    })

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'coste_hora',
      entidadId: tarifaId,
      accion: 'EDITAR_TARIFA',
      despues: parsed.data,
    })

    revalidatePath('/admin/costes')
    return { ok: 'Tarifa actualizada' }
  } catch (error) {
    return aError(error)
  }
}

export async function eliminarTarifaAction(
  _prev: EstadoCoste,
  formData: FormData,
): Promise<EstadoCoste> {
  try {
    const actor = await autorizar('ADMIN')
    const tarifaId = String(formData.get('tarifaId') ?? '')
    if (!tarifaId) return { error: 'Tarifa no indicada' }

    await eliminarTarifa(depsCoste, actor, tarifaId)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'coste_hora',
      entidadId: tarifaId,
      accion: 'ELIMINAR_TARIFA',
    })

    revalidatePath('/admin/costes')
    return { ok: 'Tarifa eliminada. Los costes ya aprobados conservan su importe.' }
  } catch (error) {
    return aError(error)
  }
}

const presupuestoSchema = z.object({
  proyectoId: z.string().uuid('Selecciona un proyecto'),
  importeCents: z.number().int().positive('El importe debe ser mayor que cero'),
  horasPresupuesto: z.number().int().min(0).nullable(),
  motivo: z.string().trim().max(300).nullable(),
})

export async function crearPresupuestoAction(
  _prev: EstadoCoste,
  formData: FormData,
): Promise<EstadoCoste> {
  try {
    const actor = await autorizar('ADMIN')
    const horasTexto = String(formData.get('horas') ?? '').trim().replace(',', '.')
    const horas = horasTexto === '' ? null : Number(horasTexto)

    const parsed = presupuestoSchema.safeParse({
      proyectoId: String(formData.get('proyectoId') ?? ''),
      importeCents: eurosACentimos(String(formData.get('importe') ?? '')) ?? -1,
      horasPresupuesto: horas !== null && Number.isFinite(horas) ? Math.round(horas) : null,
      motivo: String(formData.get('motivo') ?? '').trim() || null,
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const version = await crearPresupuesto(depsCoste, actor, parsed.data.proyectoId, {
      importeCents: parsed.data.importeCents,
      horasPresupuesto: parsed.data.horasPresupuesto,
      motivo: parsed.data.motivo,
    })

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'presupuesto_proyecto',
      entidadId: parsed.data.proyectoId,
      accion: 'NUEVA_VERSION_PRESUPUESTO',
      despues: { ...parsed.data, version },
    })

    revalidatePath('/admin/costes')
    return { ok: `Presupuesto actualizado a la versión ${version}` }
  } catch (error) {
    return aError(error)
  }
}

export async function recalcularCosteAction(
  _prev: EstadoCoste,
  formData: FormData,
): Promise<EstadoCoste> {
  try {
    const actor = await autorizar('ADMIN')
    const parteId = String(formData.get('parteId') ?? '')
    if (!parteId) return { error: 'Parte no indicado' }

    const resumen = await costearParte(depsCoste, parteId)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'parte',
      entidadId: parteId,
      accion: 'RECALCULAR_COSTE',
      despues: { totalCents: resumen.totalCents, sinTarifa: resumen.sinTarifa },
    })

    revalidatePath(`/control/partes/${parteId}`)
    return { ok: 'Coste recalculado' }
  } catch (error) {
    return aError(error)
  }
}
