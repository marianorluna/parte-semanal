'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { depsCalendario } from '@/composition'
import {
  actualizarCalendario,
  actualizarFestivo,
  alternarCalendario,
  asignarEmpleadoACalendario,
  crearCalendario,
  crearExcepcion,
  crearFestivo,
  crearJornada,
  eliminarExcepcion,
  eliminarFestivo,
  eliminarJornada,
  generarFestivosAnio,
  importarFestivosCsv,
  quitarAsignacionCalendario,
} from '@/modules/calendario/application/servicio'
import type { AmbitoCalendario } from '@/db/schema'
import { AppError } from '@/shared/errors'

export type EstadoCalendario = {
  error?: string
  ok?: string
  campo?: Record<string, string>
  informe?: { creados: number; duplicados: number; rechazos: { linea: number; motivo: string }[] }
}

function aError(error: unknown): EstadoCalendario {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[admin/calendario]', error)
  return { error: 'No se pudo completar la operación' }
}

function erroresDeZod(error: z.ZodError): EstadoCalendario {
  const campo: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (clave && !campo[clave]) campo[clave] = issue.message
  }
  return { error: 'Revisa los campos marcados', campo }
}

/** Convierte horas decimales del formulario a minutos enteros. */
function minutosDeHoras(valor: FormDataEntryValue | null): number | null {
  if (valor === null) return null
  const texto = String(valor).trim().replace(',', '.')
  if (texto === '') return null
  const horas = Number(texto)
  if (!Number.isFinite(horas) || horas < 0) return null
  return Math.round(horas * 60)
}

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

const calendarioSchema = z.object({
  nombre: z.string().trim().min(3, 'Nombre obligatorio').max(120),
  ambito: z.enum(['NACIONAL', 'CCAA', 'PROVINCIA', 'LOCAL', 'EMPRESA']),
  codigo: z.string().trim().min(2, 'Código obligatorio').max(30),
  comunidad: z.string().trim().max(10).nullable(),
  diasSemana: z.array(z.number().int().min(1).max(7)).min(1, 'Selecciona al menos un día'),
  horasDiariasMin: z.number().int().min(1).max(1440).nullable(),
  vigenteDesde: fechaIso,
  vigenteHasta: fechaIso.nullable(),
  esPredeterminado: z.boolean(),
})

function leerCalendario(formData: FormData) {
  const dias = formData
    .getAll('diasSemana')
    .map((valor) => Number(valor))
    .filter((valor) => Number.isInteger(valor))
  const hasta = String(formData.get('vigenteHasta') ?? '')

  return calendarioSchema.safeParse({
    nombre: formData.get('nombre') ?? '',
    ambito: String(formData.get('ambito') ?? 'EMPRESA'),
    codigo: String(formData.get('codigo') ?? ''),
    comunidad: String(formData.get('comunidad') ?? '').trim() || null,
    diasSemana: dias,
    horasDiariasMin: minutosDeHoras(formData.get('horasDiarias')),
    vigenteDesde: String(formData.get('vigenteDesde') ?? ''),
    vigenteHasta: hasta === '' ? null : hasta,
    esPredeterminado: formData.get('esPredeterminado') === 'on',
  })
}

export async function crearCalendarioAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = leerCalendario(formData)
    if (!parsed.success) return erroresDeZod(parsed.error)

    const id = await crearCalendario(depsCalendario, actor, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'calendario',
      entidadId: id,
      accion: 'CREAR_CALENDARIO',
      despues: { codigo: parsed.data.codigo, nombre: parsed.data.nombre },
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Calendario creado' }
  } catch (error) {
    return aError(error)
  }
}

export async function actualizarCalendarioAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const calendarioId = String(formData.get('calendarioId') ?? '')
    if (!calendarioId) return { error: 'Calendario no indicado' }

    const parsed = leerCalendario(formData)
    if (!parsed.success) return erroresDeZod(parsed.error)

    const version = await actualizarCalendario(depsCalendario, actor, calendarioId, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'calendario',
      entidadId: calendarioId,
      accion: 'EDITAR_CALENDARIO',
      despues: { ...parsed.data, version },
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Calendario actualizado' }
  } catch (error) {
    return aError(error)
  }
}

export async function alternarCalendarioAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const calendarioId = String(formData.get('calendarioId') ?? '')
    const activo = formData.get('activo') === 'true'
    if (!calendarioId) return { error: 'Calendario no indicado' }

    await alternarCalendario(depsCalendario, actor, calendarioId, activo)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'calendario',
      entidadId: calendarioId,
      accion: activo ? 'ACTIVAR_CALENDARIO' : 'DESACTIVAR_CALENDARIO',
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: activo ? 'Calendario activado' : 'Calendario desactivado' }
  } catch (error) {
    return aError(error)
  }
}

const festivoSchema = z.object({
  calendarioId: z.string().uuid('Calendario inválido'),
  fecha: fechaIso,
  nombre: z.string().trim().min(2, 'Nombre obligatorio').max(120),
  ambito: z.enum(['NACIONAL', 'CCAA', 'PROVINCIA', 'LOCAL', 'EMPRESA']),
  esLaborable: z.boolean(),
})

export async function crearFestivoAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = festivoSchema.safeParse({
      calendarioId: formData.get('calendarioId'),
      fecha: String(formData.get('fecha') ?? ''),
      nombre: formData.get('nombre') ?? '',
      ambito: String(formData.get('ambito') ?? 'EMPRESA'),
      esLaborable: formData.get('esLaborable') === 'on',
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    await crearFestivo(depsCalendario, actor, parsed.data.calendarioId, {
      fecha: parsed.data.fecha,
      nombre: parsed.data.nombre,
      ambito: parsed.data.ambito as AmbitoCalendario,
      esLaborable: parsed.data.esLaborable,
    })
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'festivo',
      entidadId: parsed.data.calendarioId,
      accion: 'CREAR_FESTIVO',
      despues: { fecha: parsed.data.fecha, nombre: parsed.data.nombre },
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Festivo añadido' }
  } catch (error) {
    return aError(error)
  }
}

export async function alternarFestivoAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const calendarioId = String(formData.get('calendarioId') ?? '')
    const festivoId = String(formData.get('festivoId') ?? '')
    const esLaborable = formData.get('esLaborable') === 'true'
    const fecha = String(formData.get('fecha') ?? '')
    const nombre = String(formData.get('nombre') ?? '')
    const ambito = String(formData.get('ambito') ?? 'EMPRESA')

    if (!calendarioId || !festivoId) return { error: 'Festivo no indicado' }

    await actualizarFestivo(depsCalendario, actor, calendarioId, festivoId, {
      fecha,
      nombre,
      ambito: ambito as AmbitoCalendario,
      esLaborable,
    })
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'festivo',
      entidadId: festivoId,
      accion: esLaborable ? 'ABRIR_FESTIVO' : 'CERRAR_FESTIVO',
      despues: { fecha, esLaborable },
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: esLaborable ? 'Festivo marcado como laborable' : 'Festivo marcado como no laborable' }
  } catch (error) {
    return aError(error)
  }
}

export async function eliminarFestivoAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const calendarioId = String(formData.get('calendarioId') ?? '')
    const festivoId = String(formData.get('festivoId') ?? '')
    const fecha = String(formData.get('fecha') ?? '')
    if (!calendarioId || !festivoId) return { error: 'Festivo no indicado' }

    await eliminarFestivo(depsCalendario, actor, calendarioId, festivoId, fecha)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'festivo',
      entidadId: festivoId,
      accion: 'ELIMINAR_FESTIVO',
      antes: { fecha },
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Festivo eliminado' }
  } catch (error) {
    return aError(error)
  }
}

export async function generarFestivosAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const calendarioId = String(formData.get('calendarioId') ?? '')
    const anio = Number(formData.get('anio'))
    if (!calendarioId || !Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      return { error: 'Año no válido' }
    }

    const creados = await generarFestivosAnio(depsCalendario, actor, calendarioId, anio)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'calendario',
      entidadId: calendarioId,
      accion: 'GENERAR_FESTIVOS',
      despues: { anio, creados },
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return {
      ok:
        creados === 0
          ? `No había festivos nuevos que añadir para ${anio}`
          : `${creados} festivos añadidos para ${anio}. Revisa los traslados antes de publicar.`,
    }
  } catch (error) {
    return aError(error)
  }
}

export async function importarFestivosAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const calendarioId = String(formData.get('calendarioId') ?? '')
    const contenido = String(formData.get('csv') ?? '')
    if (!calendarioId) return { error: 'Calendario no indicado' }
    if (contenido.trim() === '') return { error: 'Pega las líneas del CSV antes de importar' }

    const resultado = await importarFestivosCsv(depsCalendario, actor, calendarioId, contenido)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'calendario',
      entidadId: calendarioId,
      accion: 'IMPORTAR_FESTIVOS',
      despues: { creados: resultado.creados, duplicados: resultado.duplicados },
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return {
      ok: `${resultado.creados} festivos importados`,
      informe: {
        creados: resultado.creados,
        duplicados: resultado.duplicados,
        rechazos: resultado.rechazos.map((rechazo) => ({
          linea: rechazo.linea,
          motivo: rechazo.motivo,
        })),
      },
    }
  } catch (error) {
    return aError(error)
  }
}

const excepcionSchema = z.object({
  calendarioId: z.string().uuid(),
  fecha: fechaIso,
  laborable: z.boolean(),
  motivo: z.string().trim().min(3, 'Explica el motivo').max(160),
})

export async function crearExcepcionAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = excepcionSchema.safeParse({
      calendarioId: formData.get('calendarioId'),
      fecha: String(formData.get('fecha') ?? ''),
      laborable: formData.get('laborable') === 'true',
      motivo: formData.get('motivo') ?? '',
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    await crearExcepcion(depsCalendario, actor, parsed.data.calendarioId, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'excepcion_calendario',
      entidadId: parsed.data.calendarioId,
      accion: parsed.data.laborable ? 'ABRIR_DIA' : 'CERRAR_DIA',
      despues: parsed.data,
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Excepción guardada' }
  } catch (error) {
    return aError(error)
  }
}

export async function eliminarExcepcionAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const calendarioId = String(formData.get('calendarioId') ?? '')
    const excepcionId = String(formData.get('excepcionId') ?? '')
    if (!calendarioId || !excepcionId) return { error: 'Excepción no indicada' }

    await eliminarExcepcion(depsCalendario, actor, calendarioId, excepcionId)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'excepcion_calendario',
      entidadId: excepcionId,
      accion: 'ELIMINAR_EXCEPCION',
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Excepción eliminada' }
  } catch (error) {
    return aError(error)
  }
}

const jornadaSchema = z.object({
  calendarioId: z.string().uuid(),
  empleadoId: z.string().uuid().nullable(),
  desde: fechaIso,
  hasta: fechaIso.nullable(),
  horasSemanalesMin: z.number().int().min(1).max(10_080),
  horasDiariasMin: z.number().int().min(1).max(1440).nullable(),
})

export async function crearJornadaAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const hasta = String(formData.get('hasta') ?? '')
    const empleadoId = String(formData.get('empleadoId') ?? '')

    const parsed = jornadaSchema.safeParse({
      calendarioId: formData.get('calendarioId'),
      empleadoId: empleadoId === '' ? null : empleadoId,
      desde: String(formData.get('desde') ?? ''),
      hasta: hasta === '' ? null : hasta,
      horasSemanalesMin: minutosDeHoras(formData.get('horasSemanales')) ?? 0,
      horasDiariasMin: minutosDeHoras(formData.get('horasDiarias')),
    })
    if (!parsed.success) return erroresDeZod(parsed.error)

    await crearJornada(depsCalendario, actor, parsed.data.calendarioId, parsed.data)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'jornada_teorica',
      entidadId: parsed.data.calendarioId,
      accion: 'CREAR_JORNADA',
      despues: parsed.data,
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Jornada teórica guardada' }
  } catch (error) {
    return aError(error)
  }
}

export async function eliminarJornadaAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const calendarioId = String(formData.get('calendarioId') ?? '')
    const jornadaId = String(formData.get('jornadaId') ?? '')
    if (!calendarioId || !jornadaId) return { error: 'Jornada no indicada' }

    await eliminarJornada(depsCalendario, actor, calendarioId, jornadaId)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'jornada_teorica',
      entidadId: jornadaId,
      accion: 'ELIMINAR_JORNADA',
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Jornada eliminada' }
  } catch (error) {
    return aError(error)
  }
}

export async function asignarEmpleadoAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = z
      .object({
        calendarioId: z.string().uuid(),
        empleadoId: z.string().uuid('Selecciona un empleado'),
        desde: fechaIso,
      })
      .safeParse({
        calendarioId: formData.get('calendarioId'),
        empleadoId: formData.get('empleadoId'),
        desde: String(formData.get('desde') ?? ''),
      })
    if (!parsed.success) return erroresDeZod(parsed.error)

    await asignarEmpleadoACalendario(
      depsCalendario,
      actor,
      parsed.data.calendarioId,
      parsed.data.empleadoId,
      parsed.data.desde,
    )
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'empleado_calendario',
      entidadId: parsed.data.empleadoId,
      accion: 'ASIGNAR_CALENDARIO',
      despues: { calendarioId: parsed.data.calendarioId, desde: parsed.data.desde },
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Calendario asignado' }
  } catch (error) {
    return aError(error)
  }
}

export async function quitarAsignacionAction(
  _prev: EstadoCalendario,
  formData: FormData,
): Promise<EstadoCalendario> {
  try {
    const actor = await autorizar('ADMIN')
    const asignacionId = String(formData.get('asignacionId') ?? '')
    if (!asignacionId) return { error: 'Asignación no indicada' }

    await quitarAsignacionCalendario(depsCalendario, actor, asignacionId)
    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'empleado_calendario',
      entidadId: asignacionId,
      accion: 'QUITAR_ASIGNACION_CALENDARIO',
    })

    revalidatePath('/admin/calendario')
    revalidatePath('/mi-semana')
    return { ok: 'Asignación eliminada' }
  } catch (error) {
    return aError(error)
  }
}
