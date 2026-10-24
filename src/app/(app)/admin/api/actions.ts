'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { depsIntegraciones } from '@/composition'
import {
  cambiarEstadoWebhook,
  crearClaveApi,
  crearWebhook,
  revocarClaveApi,
} from '@/modules/integraciones/application/servicio'
import { ALCANCES, EVENTOS } from '@/modules/integraciones/domain/api'
import { esProduccion } from '@/config/env'
import { AppError } from '@/shared/errors'

export type EstadoApi = {
  error?: string
  ok?: string
  clave?: string
  secreto?: string
  campo?: Record<string, string>
}

function aError(error: unknown): EstadoApi {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[admin/api]', error)
  return { error: 'No se pudo completar la operación' }
}

function erroresDeZod(error: z.ZodError): EstadoApi {
  const campo: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (clave && !campo[clave]) campo[clave] = issue.message
  }
  return { error: 'Revisa los campos marcados', campo }
}

const claveSchema = z.object({
  nombre: z.string().trim().min(3, 'Mínimo 3 caracteres').max(80),
  alcances: z.array(z.enum(ALCANCES)).min(1, 'Selecciona al menos un alcance'),
  caduca: z.string().trim().optional(),
})

export async function crearClaveAction(
  _prev: EstadoApi,
  formData: FormData,
): Promise<EstadoApi> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = claveSchema.safeParse({
      nombre: String(formData.get('nombre') ?? ''),
      alcances: formData.getAll('alcances').map(String),
      caduca: String(formData.get('caduca') ?? '').trim(),
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const caducaAt = parsed.data.caduca
      ? new Date(`${parsed.data.caduca}T23:59:59.999Z`)
      : null
    if (caducaAt && Number.isNaN(caducaAt.getTime())) {
      return { error: 'Fecha de caducidad inválida', campo: { caduca: 'Fecha inválida' } }
    }

    const resultado = await crearClaveApi(depsIntegraciones, actor.empresaId, {
      nombre: parsed.data.nombre,
      alcances: parsed.data.alcances,
      caducaAt,
    })

    revalidatePath('/admin/api')
    return {
      ok: `Clave «${parsed.data.nombre}» creada. Cópiala ahora: no se volverá a mostrar.`,
      clave: resultado.clave,
    }
  } catch (error) {
    return aError(error)
  }
}

const idSchema = z.object({ id: z.uuid('Identificador inválido') })

export async function revocarClaveAction(
  _prev: EstadoApi,
  formData: FormData,
): Promise<EstadoApi> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = idSchema.safeParse({ id: String(formData.get('id') ?? '') })
    if (!parsed.success) return erroresDeZod(parsed.error)

    await revocarClaveApi(depsIntegraciones, actor.empresaId, parsed.data.id)
    revalidatePath('/admin/api')
    return { ok: 'Clave revocada' }
  } catch (error) {
    return aError(error)
  }
}

const webhookSchema = z.object({
  nombre: z.string().trim().min(3, 'Mínimo 3 caracteres').max(80),
  url: z.string().trim().url('URL inválida'),
  eventos: z.array(z.enum(EVENTOS)).min(1, 'Selecciona al menos un evento'),
})

export async function crearWebhookAction(
  _prev: EstadoApi,
  formData: FormData,
): Promise<EstadoApi> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = webhookSchema.safeParse({
      nombre: String(formData.get('nombre') ?? ''),
      url: String(formData.get('url') ?? ''),
      eventos: formData.getAll('eventos').map(String),
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const resultado = await crearWebhook(
      depsIntegraciones,
      actor.empresaId,
      parsed.data,
      !esProduccion(),
    )

    revalidatePath('/admin/api')
    return {
      ok: `Webhook «${parsed.data.nombre}» creado. Guarda el secreto: solo se muestra una vez.`,
      secreto: resultado.secreto,
    }
  } catch (error) {
    return aError(error)
  }
}

export async function cambiarWebhookAction(
  _prev: EstadoApi,
  formData: FormData,
): Promise<EstadoApi> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = idSchema.safeParse({ id: String(formData.get('id') ?? '') })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const activo = formData.get('activo') === 'true'
    await cambiarEstadoWebhook(depsIntegraciones, actor.empresaId, parsed.data.id, activo)
    revalidatePath('/admin/api')
    return { ok: activo ? 'Webhook activado' : 'Webhook desactivado' }
  } catch (error) {
    return aError(error)
  }
}
