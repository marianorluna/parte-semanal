'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { depsCierre } from '@/composition'
import { cerrarPeriodo, reabrirPeriodo } from '@/modules/cierre/application/servicio'
import { AppError } from '@/shared/errors'

export type EstadoCierre = {
  error?: string
  ok?: string
  campo?: Record<string, string>
}

function aError(error: unknown): EstadoCierre {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[admin/cierres]', error)
  return { error: 'No se pudo completar la operación' }
}

function erroresDeZod(error: z.ZodError): EstadoCierre {
  const campo: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (clave && !campo[clave]) campo[clave] = issue.message
  }
  return { error: 'Revisa los campos marcados', campo }
}

const motivoSchema = z.string().trim().max(300).nullable()

const semanalSchema = z.object({
  anio: z.coerce.number().int().min(2000, 'Año inválido').max(2100, 'Año inválido'),
  semana: z.coerce.number().int().min(1, 'Semana inválida').max(53, 'Semana inválida'),
  empleadoId: z.string().uuid().nullable(),
  motivo: motivoSchema,
})

const mensualSchema = z.object({
  anio: z.coerce.number().int().min(2000, 'Año inválido').max(2100, 'Año inválido'),
  mes: z.coerce.number().int().min(1, 'Mes inválido').max(12, 'Mes inválido'),
  empleadoId: z.string().uuid('Selecciona un empleado'),
  motivo: motivoSchema,
})

export async function cerrarSemanaAction(
  _prev: EstadoCierre,
  formData: FormData,
): Promise<EstadoCierre> {
  try {
    const actor = await autorizar('ADMIN')
    const empleadoId = String(formData.get('empleadoId') ?? '').trim()

    const parsed = semanalSchema.safeParse({
      anio: formData.get('anio'),
      semana: formData.get('semana'),
      empleadoId: empleadoId === '' ? null : empleadoId,
      motivo: String(formData.get('motivo') ?? '').trim() || null,
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const resultado = await cerrarPeriodo(
      depsCierre,
      actor,
      {
        tipo: 'SEMANAL',
        isoYear: parsed.data.anio,
        isoWeek: parsed.data.semana,
        empleadoId: parsed.data.empleadoId,
      },
      parsed.data.motivo,
    )

    revalidatePath('/admin/cierres')
    revalidatePath('/control/partes')
    return {
      ok: `${resultado.etiqueta} cerrada: ${resultado.partesBloqueados} partes bloqueados`,
    }
  } catch (error) {
    return aError(error)
  }
}

export async function cerrarMesAction(
  _prev: EstadoCierre,
  formData: FormData,
): Promise<EstadoCierre> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = mensualSchema.safeParse({
      anio: formData.get('anio'),
      mes: formData.get('mes'),
      empleadoId: String(formData.get('empleadoId') ?? ''),
      motivo: String(formData.get('motivo') ?? '').trim() || null,
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const resultado = await cerrarPeriodo(
      depsCierre,
      actor,
      {
        tipo: 'MENSUAL',
        anio: parsed.data.anio,
        mes: parsed.data.mes,
        empleadoId: parsed.data.empleadoId,
      },
      parsed.data.motivo,
    )

    revalidatePath('/admin/cierres')
    revalidatePath('/control/partes')
    return {
      ok: `${resultado.etiqueta} cerrado: ${resultado.partesBloqueados} partes bloqueados`,
    }
  } catch (error) {
    return aError(error)
  }
}

const reaperturaSchema = z.object({
  periodoId: z.string().uuid('Periodo inválido'),
  motivo: z.string().trim().min(5, 'Escribe un motivo de al menos 5 caracteres').max(300),
})

export async function reabrirPeriodoAction(
  _prev: EstadoCierre,
  formData: FormData,
): Promise<EstadoCierre> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = reaperturaSchema.safeParse({
      periodoId: String(formData.get('periodoId') ?? ''),
      motivo: String(formData.get('motivo') ?? ''),
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const resultado = await reabrirPeriodo(
      depsCierre,
      actor,
      parsed.data.periodoId,
      parsed.data.motivo,
    )

    revalidatePath('/admin/cierres')
    revalidatePath('/control/partes')
    return {
      ok: `Periodo reabierto: ${resultado.partesDesbloqueados} partes desbloqueados y ${resultado.recalculados} recalculados`,
    }
  } catch (error) {
    return aError(error)
  }
}
