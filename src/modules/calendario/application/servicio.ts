import type { AmbitoCalendario } from '@/db/schema'
import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import { AppError } from '@/shared/errors'
import {
  aFecha,
  esFechaIso,
  type FechaIso,
  type SemanaIso,
  sumarDias,
} from '@/modules/partes/domain/fechas'
import {
  CALENDARIO_POR_DEFECTO,
  capacidadSemanal,
  normalizarDiasSemana,
  resolverDia,
  type CalendarioResuelto,
  type DiaCalendario,
} from '../domain/calendario'
import { festivosDeReferencia, type FestivoCatalogo } from '../domain/festivos-espana'
import type {
  CalendarioCompleto,
  DatosCalendario,
  DatosExcepcion,
  DatosFestivo,
  DatosJornada,
  RepositorioCalendario,
} from './ports'

export type DepsCalendario = {
  repo: RepositorioCalendario
}

export type SemanaCalendario = {
  calendarioId: string | null
  calendarioVersion: number | null
  dias: DiaCalendario[]
  capacidadMin: number | null
  /** Sin calendario configurado se aplica lunes-viernes sin festivos. */
  porDefecto: boolean
}

function exigirId(valor: string | undefined | null, mensaje: string): string {
  if (!valor) throw new AppError('VALIDACION', mensaje)
  return valor
}

/** Jornada diaria aplicable: primero el override del empleado, luego el calendario. */
export function horasDiariasEnFecha(
  calendario: CalendarioCompleto,
  empleadoId: string | null,
  fecha: FechaIso,
): number | null {
  if (empleadoId) {
    const propia = calendario.jornadas.find(
      (jornada) =>
        jornada.empleadoId === empleadoId &&
        jornada.desde <= fecha &&
        (jornada.hasta === null || jornada.hasta >= fecha),
    )
    if (propia?.horasDiariasMin) return propia.horasDiariasMin
  }

  const general = calendario.jornadas.find(
    (jornada) =>
      jornada.empleadoId === null &&
      jornada.desde <= fecha &&
      (jornada.hasta === null || jornada.hasta >= fecha),
  )
  if (general?.horasDiariasMin) return general.horasDiariasMin

  return calendario.horasDiariasMin
}

export function calendarioEnFecha(
  calendario: CalendarioCompleto,
  empleadoId: string | null,
  fecha: FechaIso,
): CalendarioResuelto {
  return {
    diasSemana: calendario.diasSemana,
    festivos: calendario.festivos,
    excepciones: calendario.excepciones,
    horasDiariasMin: horasDiariasEnFecha(calendario, empleadoId, fecha),
  }
}

/** Resuelve una semana completa. Es la única fuente de días laborables. */
export async function obtenerSemanaCalendario(
  deps: DepsCalendario,
  empleadoId: string,
  semana: SemanaIso,
): Promise<SemanaCalendario> {
  const calendario = await deps.repo.calendarioDeEmpleado(empleadoId, semana.weekStart)

  if (!calendario) {
    const dias = Array.from({ length: 7 }, (_, indice) =>
      resolverDia(CALENDARIO_POR_DEFECTO, sumarDias(semana.weekStart, indice)),
    )
    return {
      calendarioId: null,
      calendarioVersion: null,
      dias,
      capacidadMin: capacidadSemanal(dias),
      porDefecto: true,
    }
  }

  const dias = Array.from({ length: 7 }, (_, indice) => {
    const fecha = sumarDias(semana.weekStart, indice)
    return resolverDia(calendarioEnFecha(calendario, empleadoId, fecha), fecha)
  })

  return {
    calendarioId: calendario.id,
    calendarioVersion: calendario.version,
    dias,
    capacidadMin: capacidadSemanal(dias),
    porDefecto: false,
  }
}

/* -------------------------------------------------------------------------- */
/* Administración de calendarios                                              */
/* -------------------------------------------------------------------------- */

function validarDatos(datos: DatosCalendario): DatosCalendario {
  const dias = normalizarDiasSemana(datos.diasSemana)
  if (dias.length === 0) {
    throw new AppError('VALIDACION', 'Selecciona al menos un día laborable', {
      diasSemana: 'Indica al menos un día',
    })
  }
  if (datos.vigenteHasta && datos.vigenteDesde > datos.vigenteHasta) {
    throw new AppError('VALIDACION', 'La vigencia no puede terminar antes de empezar', {
      vigenteHasta: 'Fecha anterior al inicio',
    })
  }
  if (datos.horasDiariasMin !== null && (datos.horasDiariasMin <= 0 || datos.horasDiariasMin > 1440)) {
    throw new AppError('VALIDACION', 'La jornada diaria debe estar entre 1 minuto y 24 horas', {
      horasDiariasMin: 'Fuera de rango',
    })
  }
  return { ...datos, diasSemana: dias, codigo: datos.codigo.trim().toUpperCase() }
}

export async function crearCalendario(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  datos: DatosCalendario,
): Promise<string> {
  return deps.repo.crear(usuario.empresaId, validarDatos(datos))
}

export async function actualizarCalendario(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  datos: DatosCalendario,
): Promise<number> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)
  return deps.repo.actualizar(calendarioId, validarDatos(datos))
}

export async function alternarCalendario(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  activo: boolean,
): Promise<void> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)
  await deps.repo.alternar(calendarioId, activo)
}

async function exigirCalendarioDeEmpresa(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
): Promise<void> {
  const pertenece = await deps.repo.perteneceAEmpresa(calendarioId, usuario.empresaId)
  if (!pertenece) throw new AppError('NO_ENCONTRADO', 'El calendario no existe')
}

export async function crearFestivo(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  datos: DatosFestivo,
): Promise<void> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)
  if (!esFechaIso(datos.fecha)) {
    throw new AppError('VALIDACION', 'La fecha del festivo no es válida', { fecha: 'Fecha inválida' })
  }
  if (datos.nombre.trim().length < 2) {
    throw new AppError('VALIDACION', 'Escribe un nombre para el festivo', { nombre: 'Nombre obligatorio' })
  }

  const creados = await deps.repo.crearFestivos(calendarioId, [
    { ...datos, nombre: datos.nombre.trim(), origen: 'ADMIN' },
  ])
  if (creados === 0) {
    throw new AppError('VALIDACION', 'Ya hay un festivo en esa fecha', { fecha: 'Fecha duplicada' })
  }
}

export async function actualizarFestivo(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  festivoId: string,
  datos: DatosFestivo,
): Promise<void> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)
  await deps.repo.actualizarFestivo(calendarioId, festivoId, { ...datos, nombre: datos.nombre.trim() })
}

export async function eliminarFestivo(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  festivoId: string,
  fecha: FechaIso,
): Promise<void> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)

  const aprobados = await deps.repo.contarPartesAprobadosEnFecha(calendarioId, fecha)
  if (aprobados > 0) {
    throw new AppError(
      'ESTADO_INVALIDO',
      'Hay partes aprobados en esa semana: marca el festivo como laborable en lugar de eliminarlo',
    )
  }

  await deps.repo.eliminarFestivo(calendarioId, festivoId)
}

export async function crearExcepcion(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  datos: DatosExcepcion,
): Promise<void> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)
  if (!esFechaIso(datos.fecha)) {
    throw new AppError('VALIDACION', 'La fecha de la excepción no es válida', { fecha: 'Fecha inválida' })
  }
  if (datos.motivo.trim().length < 3) {
    throw new AppError('VALIDACION', 'Explica el motivo de la excepción', { motivo: 'Motivo obligatorio' })
  }
  await deps.repo.crearExcepcion(calendarioId, { ...datos, motivo: datos.motivo.trim() })
}

export async function eliminarExcepcion(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  excepcionId: string,
): Promise<void> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)
  await deps.repo.eliminarExcepcion(calendarioId, excepcionId)
}

export async function crearJornada(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  datos: DatosJornada,
): Promise<void> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)
  if (datos.horasSemanalesMin <= 0) {
    throw new AppError('VALIDACION', 'La jornada semanal debe ser mayor que cero', {
      horasSemanalesMin: 'Valor no válido',
    })
  }
  await deps.repo.crearJornada(calendarioId, datos)
}

export async function eliminarJornada(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  jornadaId: string,
): Promise<void> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)
  await deps.repo.eliminarJornada(calendarioId, jornadaId)
}

export async function asignarEmpleadoACalendario(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  empleadoId: string,
  desde: FechaIso,
): Promise<void> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)
  if (!esFechaIso(desde)) {
    throw new AppError('VALIDACION', 'La fecha de inicio no es válida', { desde: 'Fecha inválida' })
  }
  await deps.repo.asignarEmpleado(empleadoId, calendarioId, desde)
}

export async function quitarAsignacionCalendario(
  _deps: DepsCalendario,
  usuario: UsuarioSesion,
  asignacionId: string,
): Promise<void> {
  const id = exigirId(asignacionId, 'Asignación no indicada')
  const asignaciones = await _deps.repo.listarAsignaciones(usuario.empresaId)
  if (!asignaciones.some((asignacion) => asignacion.id === id)) {
    throw new AppError('NO_ENCONTRADO', 'La asignación no existe')
  }
  await _deps.repo.quitarAsignacion(id)
}

/* -------------------------------------------------------------------------- */
/* Precarga e importación                                                     */
/* -------------------------------------------------------------------------- */

function aDatosFestivo(festivo: FestivoCatalogo): DatosFestivo {
  return {
    fecha: festivo.fecha,
    nombre: festivo.nombre,
    ambito: festivo.ambito,
    esLaborable: false,
    origen: 'SEED',
  }
}

/**
 * Precarga los festivos de referencia de un año. Es idempotente: las fechas que
 * ya existen no se tocan, así que repetirla no duplica ni sobrescribe ajustes.
 */
export async function generarFestivosAnio(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  anio: number,
): Promise<number> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)

  const calendario = await deps.repo.obtener(calendarioId)
  if (!calendario) throw new AppError('NO_ENCONTRADO', 'El calendario no existe')

  const referencia = festivosDeReferencia(anio, calendario.comunidad ?? undefined)
  return deps.repo.crearFestivos(calendarioId, referencia.map(aDatosFestivo))
}

export type RechazoImportacion = { linea: number; contenido: string; motivo: string }

export type ResultadoImportacion = {
  creados: number
  duplicados: number
  rechazos: RechazoImportacion[]
}

/** Convierte `DD/MM/YYYY` a `YYYY-MM-DD`; `null` si no es una fecha válida. */
function normalizarFecha(texto: string): FechaIso | null {
  const limpio = texto.trim()
  if (esFechaIso(limpio)) return limpio

  const partes = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(limpio)
  if (!partes) return null

  const dia = Number(partes[1])
  const mes = Number(partes[2])
  const anio = Number(partes[3])
  const candidata = `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  return esFechaIso(candidata) ? candidata : null
}

/**
 * Importa festivos desde CSV. Formato: `fecha;nombre[;laborable]`. Acepta
 * `YYYY-MM-DD` y `DD/MM/YYYY`, ignorando cabecera y líneas vacías. Devuelve el
 * informe por fila para que el administrador corrija lo rechazado.
 */
export async function importarFestivosCsv(
  deps: DepsCalendario,
  usuario: UsuarioSesion,
  calendarioId: string,
  contenido: string,
): Promise<ResultadoImportacion> {
  await exigirCalendarioDeEmpresa(deps, usuario, calendarioId)

  const lineas = contenido.split(/\r?\n/)
  const validos: DatosFestivo[] = []
  const rechazos: RechazoImportacion[] = []

  lineas.forEach((linea, indice) => {
    const numero = indice + 1
    const texto = linea.trim()
    if (texto === '') return
    if (/^fecha\s*[;,\t]/i.test(texto)) return

    const columnas = texto.split(/[;,\t]/).map((columna) => columna.trim())
    const fecha = normalizarFecha(columnas[0] ?? '')
    const nombre = columnas[1] ?? ''

    if (!fecha) {
      rechazos.push({ linea: numero, contenido: texto, motivo: 'Fecha no válida (usa AAAA-MM-DD o DD/MM/AAAA)' })
      return
    }
    if (nombre.length < 2) {
      rechazos.push({ linea: numero, contenido: texto, motivo: 'Falta el nombre del festivo' })
      return
    }

    const laborable = ['si', 'sí', 'true', '1'].includes((columnas[2] ?? '').toLowerCase())
    validos.push({ fecha, nombre, ambito: 'EMPRESA', esLaborable: laborable, origen: 'IMPORTACION' })
  })

  const creados = await deps.repo.crearFestivos(calendarioId, validos)

  return {
    creados,
    duplicados: validos.length - creados,
    rechazos,
  }
}

/** Rango que cubre la fecha, útil para resolver jornadas en una semana. */
export function semanaDe(fecha: FechaIso, weekStart: FechaIso): number {
  return Math.round((aFecha(fecha).getTime() - aFecha(weekStart).getTime()) / 86_400_000)
}

export type { CalendarioCompleto, AmbitoCalendario }
