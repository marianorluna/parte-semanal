'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { depsAusencias } from '@/composition'
import { anularAusencia, solicitarAusencia } from '@/modules/ausencias/application/servicio'
import { AppError } from '@/shared/errors'

export type EstadoAusenciaUI = {
  error?: string
  ok?: string
  campo?: Record<string, string>
}

function aError(error: unknown): EstadoAusenciaUI {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[mis-ausencias]', error)
  return { error: 'No se pudo completar la operación' }
}

function erroresDeZod(error: z.ZodError): EstadoAusenciaUI {
  const campo: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (clave && !campo[clave]) campo[clave] = issue.message
  }
  return { error: 'Revisa los campos marcados', campo }
}

/** Horas decimales a minutos enteros; cadena vacía = jornada completa. */
function minutosDeHoras(valor: FormDataEntryValue | null): number | null {
  if (valor === null) return null
  const texto = String(valor).trim().replace(',', '.')
  if (texto === '') return null
  const horas = Number(texto)
  if (!Number.isFinite(horas) || horas < 0) return null
  return Math.max(1, Math.round(horas * 60))
}

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

const solicitudSchema = z.object({
  tipoId: z.string().uuid('Selecciona un tipo'),
  desde: fechaIso,
  hasta: fechaIso,
  minutos: z.number().int().min(1).max(1440).nullable(),
  motivo: z.string().trim().max(300).nullable(),
})

export async function solicitarAusenciaAction(
  _prev: EstadoAusenciaUI,
  formData: FormData,
): Promise<EstadoAusenciaUI> {
  try {
    const actor = await autorizar('TRABAJADOR', 'ENCARGADO', 'ADMIN')
    const motivo = String(formData.get('motivo') ?? '').trim()

    const parsed = solicitudSchema.safeParse({
      tipoId: String(formData.get('tipoId') ?? ''),
      desde: String(formData.get('desde') ?? ''),
      hasta: String(formData.get('hasta') ?? ''),
      minutos: minutosDeHoras(formData.get('horas')),
      motivo: motivo === '' ? null : motivo,
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    const id = await solicitarAusencia(depsAusencias, actor, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'ausencia',
      entidadId: id,
      accion: 'SOLICITAR_AUSENCIA',
      despues: parsed.data,
    })

    revalidatePath('/mis-ausencias')
    revalidatePath('/control/ausencias')
    return { ok: 'Solicitud registrada. Queda pendiente de aprobación.' }
  } catch (error) {
    return aError(error)
  }
}

export async function anularAusenciaAction(
  _prev: EstadoAusenciaUI,
  formData: FormData,
): Promise<EstadoAusenciaUI> {
  try {
    const actor = await autorizar('TRABAJADOR', 'ENCARGADO', 'ADMIN')
    const parsed = z
      .object({
        ausenciaId: z.string().uuid(),
        motivo: z.string().trim().min(5, 'Explica el motivo de la anulación').max(300),
      })
      .safeParse({
        ausenciaId: formData.get('ausenciaId'),
        motivo: formData.get('motivo') ?? '',
      })
    if (!parsed.success) return erroresDeZod(parsed.error)

    await anularAusencia(depsAusencias, actor, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'ausencia',
      entidadId: parsed.data.ausenciaId,
      accion: 'ANULAR_AUSENCIA',
      motivo: parsed.data.motivo,
    })

    revalidatePath('/mis-ausencias')
    revalidatePath('/control/ausencias')
    revalidatePath('/mi-semana')
    return { ok: 'Ausencia anulada' }
  } catch (error) {
    return aError(error)
  }
}
