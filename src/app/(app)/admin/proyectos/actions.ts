'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import {
  actualizarProyecto,
  alternarProyecto,
  crearAsignacion,
  crearProyecto,
  crearTarea,
  desactivarAsignacion,
} from '@/modules/organizacion/infrastructure/comandos'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { AppError } from '@/shared/errors'

const fechaIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .optional()
  .or(z.literal(''))

const plazoRefinements = (datos: { fechaInicio?: string; fechaFin?: string }) => ({
  inicio: !datos.fechaFin || Boolean(datos.fechaInicio),
  orden: !datos.fechaInicio || !datos.fechaFin || datos.fechaInicio <= datos.fechaFin,
})

const proyectoSchema = z
  .object({
    codigo: z.string().trim().min(2, 'Código obligatorio').max(30),
    nombre: z.string().trim().min(3, 'Nombre obligatorio').max(160),
    horasPresupuesto: z.coerce.number().int().min(0).max(1_000_000).optional(),
    fechaInicio: fechaIsoSchema,
    fechaFin: fechaIsoSchema,
    esAjuste: z.boolean(),
  })
  .refine((datos) => plazoRefinements(datos).inicio, {
    message: 'Indica la fecha de inicio si hay fecha de fin',
    path: ['fechaInicio'],
  })
  .refine((datos) => plazoRefinements(datos).orden, {
    message: 'La fecha de fin no puede ser anterior al inicio',
    path: ['fechaFin'],
  })

const edicionProyectoSchema = z
  .object({
    proyectoId: z.string().uuid('Proyecto inválido'),
    nombre: z.string().trim().min(3, 'Nombre obligatorio').max(160),
    horasPresupuesto: z.coerce.number().int().min(0).max(1_000_000).optional(),
    fechaInicio: fechaIsoSchema,
    fechaFin: fechaIsoSchema,
    esAjuste: z.boolean(),
  })
  .refine((datos) => plazoRefinements(datos).inicio, {
    message: 'Indica la fecha de inicio si hay fecha de fin',
    path: ['fechaInicio'],
  })
  .refine((datos) => plazoRefinements(datos).orden, {
    message: 'La fecha de fin no puede ser anterior al inicio',
    path: ['fechaFin'],
  })

export type EstadoProyecto = { error?: string; ok?: string; campo?: Record<string, string> }

function aError(error: unknown): EstadoProyecto {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[admin/proyectos]', error)
  return { error: 'No se pudo completar la operación' }
}

function leerProyectoDelFormulario(formData: FormData) {
  const horas = formData.get('horasPresupuesto')
  return proyectoSchema.safeParse({
    codigo: formData.get('codigo') ?? '',
    nombre: formData.get('nombre') ?? '',
    horasPresupuesto: horas ? Number(horas) : undefined,
    fechaInicio: String(formData.get('fechaInicio') ?? ''),
    fechaFin: String(formData.get('fechaFin') ?? ''),
    // Un checkbox ausente llega como null y su valor es 'on' cuando se marca.
    // `z.coerce.boolean()` convertiría 'false' en true.
    esAjuste: formData.get('esAjuste') === 'on',
  })
}

export async function crearProyectoAction(
  _prev: EstadoProyecto,
  formData: FormData,
): Promise<EstadoProyecto> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = leerProyectoDelFormulario(formData)

    if (!parsed.success) {
      const campo: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const clave = issue.path.join('.')
        if (clave) campo[clave] = issue.message
      }
      return { error: 'Revisa los campos marcados', campo }
    }

    await crearProyecto(actor.empresaId, {
      codigo: parsed.data.codigo.toUpperCase(),
      nombre: parsed.data.nombre,
      horasPresupuesto: parsed.data.horasPresupuesto ?? null,
      fechaInicio: parsed.data.fechaInicio || null,
      fechaFin: parsed.data.fechaFin || null,
      esAjuste: parsed.data.esAjuste,
    })

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'proyecto',
      accion: 'CREAR_PROYECTO',
      despues: { codigo: parsed.data.codigo, esAjuste: parsed.data.esAjuste },
    })

    revalidatePath('/admin/proyectos')
    return { ok: 'Proyecto creado' }
  } catch (error) {
    return aError(error)
  }
}

export async function actualizarProyectoAction(
  _prev: EstadoProyecto,
  formData: FormData,
): Promise<EstadoProyecto> {
  try {
    const actor = await autorizar('ADMIN')
    const horas = formData.get('horasPresupuesto')
    const parsed = edicionProyectoSchema.safeParse({
      proyectoId: formData.get('proyectoId'),
      nombre: formData.get('nombre') ?? '',
      horasPresupuesto: horas ? Number(horas) : undefined,
      fechaInicio: String(formData.get('fechaInicio') ?? ''),
      fechaFin: String(formData.get('fechaFin') ?? ''),
      esAjuste: formData.get('esAjuste') === 'on',
    })

    if (!parsed.success) {
      const campo: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const clave = issue.path.join('.')
        if (clave) campo[clave] = issue.message
      }
      return { error: 'Revisa los campos marcados', campo }
    }

    await actualizarProyecto(parsed.data.proyectoId, {
      nombre: parsed.data.nombre,
      horasPresupuesto: parsed.data.horasPresupuesto ?? null,
      fechaInicio: parsed.data.fechaInicio || null,
      fechaFin: parsed.data.fechaFin || null,
      esAjuste: parsed.data.esAjuste,
    })

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'proyecto',
      entidadId: parsed.data.proyectoId,
      accion: 'EDITAR_PROYECTO',
      despues: {
        nombre: parsed.data.nombre,
        horasPresupuesto: parsed.data.horasPresupuesto ?? null,
        fechaInicio: parsed.data.fechaInicio || null,
        fechaFin: parsed.data.fechaFin || null,
        esAjuste: parsed.data.esAjuste,
      },
    })

    revalidatePath('/admin/proyectos')
    revalidatePath(`/admin/proyectos/${parsed.data.proyectoId}`)
    return { ok: 'Proyecto actualizado' }
  } catch (error) {
    return aError(error)
  }
}

const tareaSchema = z.object({
  proyectoId: z.string().uuid(),
  codigo: z.string().trim().min(1, 'Código obligatorio').max(20),
  nombre: z.string().trim().min(2, 'Nombre obligatorio').max(160),
  horasPresupuesto: z.coerce.number().int().min(0).max(1_000_000).optional(),
})

export async function crearTareaAction(
  _prev: EstadoProyecto,
  formData: FormData,
): Promise<EstadoProyecto> {
  try {
    const actor = await autorizar('ADMIN')
    const horas = formData.get('horasPresupuesto')
    const parsed = tareaSchema.safeParse({
      proyectoId: formData.get('proyectoId'),
      codigo: formData.get('codigo') ?? '',
      nombre: formData.get('nombre') ?? '',
      horasPresupuesto: horas ? Number(horas) : undefined,
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
    }

    await crearTarea(parsed.data.proyectoId, {
      codigo: parsed.data.codigo.toUpperCase(),
      nombre: parsed.data.nombre,
      horasPresupuesto: parsed.data.horasPresupuesto ?? null,
    })

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'tarea',
      entidadId: parsed.data.proyectoId,
      accion: 'CREAR_TAREA',
      despues: { codigo: parsed.data.codigo },
    })

    revalidatePath(`/admin/proyectos/${parsed.data.proyectoId}`)
    return { ok: 'Tarea creada' }
  } catch (error) {
    return aError(error)
  }
}

const asignacionSchema = z.object({
  proyectoId: z.string().uuid(),
  empleadoId: z.string().uuid(),
  tareaId: z.string().uuid(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
})

export async function crearAsignacionAction(
  _prev: EstadoProyecto,
  formData: FormData,
): Promise<EstadoProyecto> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = asignacionSchema.safeParse({
      proyectoId: formData.get('proyectoId'),
      empleadoId: formData.get('empleadoId'),
      tareaId: formData.get('tareaId'),
      desde: formData.get('desde') ?? '',
      hasta: formData.get('hasta') ?? '',
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
    }

    await crearAsignacion({
      empleadoId: parsed.data.empleadoId,
      tareaId: parsed.data.tareaId,
      desde: parsed.data.desde,
      hasta: parsed.data.hasta || null,
    })

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'asignacion',
      entidadId: parsed.data.tareaId,
      accion: 'CREAR_ASIGNACION',
    })

    revalidatePath(`/admin/proyectos/${parsed.data.proyectoId}`)
    return { ok: 'Asignación creada' }
  } catch (error) {
    return aError(error)
  }
}

export async function alternarProyectoAction(_prev: EstadoProyecto, formData: FormData): Promise<EstadoProyecto> {
  try {
    const actor = await autorizar('ADMIN')
    const proyectoId = String(formData.get('proyectoId') ?? '')
    const activo = formData.get('activo') === 'true'

    if (!proyectoId) return { error: 'Proyecto no indicado' }

    await alternarProyecto(proyectoId, activo)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'proyecto',
      entidadId: proyectoId,
      accion: activo ? 'ACTIVAR_PROYECTO' : 'DESACTIVAR_PROYECTO',
    })
    revalidatePath('/admin/proyectos')
    return { ok: activo ? 'Proyecto activado' : 'Proyecto desactivado' }
  } catch (error) {
    return aError(error)
  }
}

export async function desactivarAsignacionAction(
  _prev: EstadoProyecto,
  formData: FormData,
): Promise<EstadoProyecto> {
  try {
    const actor = await autorizar('ADMIN')
    const asignacionId = String(formData.get('asignacionId') ?? '')
    const proyectoId = String(formData.get('proyectoId') ?? '')

    if (!asignacionId) return { error: 'Asignación no indicada' }

    await desactivarAsignacion(asignacionId)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'asignacion',
      entidadId: asignacionId,
      accion: 'FINALIZAR_ASIGNACION',
    })
    revalidatePath(`/admin/proyectos/${proyectoId}`)
    return { ok: 'Asignación desactivada' }
  } catch (error) {
    return aError(error)
  }
}
