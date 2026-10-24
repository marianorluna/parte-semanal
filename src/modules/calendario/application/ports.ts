import type { AmbitoCalendario, OrigenFestivo } from '@/db/schema'
import type { FechaIso } from '@/modules/partes/domain/fechas'
import type { CalendarioResuelto } from '../domain/calendario'

export type CalendarioResumen = {
  id: string
  empresaId: string
  nombre: string
  ambito: AmbitoCalendario
  codigo: string
  comunidad: string | null
  diasSemana: number[]
  horasDiariasMin: number | null
  vigenteDesde: FechaIso
  vigenteHasta: FechaIso | null
  esPredeterminado: boolean
  activo: boolean
  version: number
  festivos: number
}

export type FestivoGuardado = {
  id: string
  fecha: FechaIso
  nombre: string
  ambito: AmbitoCalendario
  esLaborable: boolean
  origen: OrigenFestivo
}

export type ExcepcionGuardada = {
  id: string
  fecha: FechaIso
  laborable: boolean
  motivo: string
}

export type JornadaGuardada = {
  id: string
  empleadoId: string | null
  desde: FechaIso
  hasta: FechaIso | null
  horasSemanalesMin: number
  horasDiariasMin: number | null
}

export type CalendarioCompleto = Omit<CalendarioResumen, 'festivos'> & {
  festivos: FestivoGuardado[]
  excepciones: ExcepcionGuardada[]
  jornadas: JornadaGuardada[]
}

export type AsignacionCalendario = {
  id: string
  empleadoId: string
  empleadoNombre: string
  empleadoCodigo: string
  calendarioId: string
  calendarioNombre: string
  desde: FechaIso
  hasta: FechaIso | null
}

export type DatosCalendario = {
  nombre: string
  ambito: AmbitoCalendario
  codigo: string
  comunidad: string | null
  diasSemana: number[]
  horasDiariasMin: number | null
  vigenteDesde: FechaIso
  vigenteHasta: FechaIso | null
  esPredeterminado: boolean
}

export type DatosFestivo = {
  fecha: FechaIso
  nombre: string
  ambito: AmbitoCalendario
  esLaborable: boolean
  origen?: OrigenFestivo
}

export type DatosExcepcion = {
  fecha: FechaIso
  laborable: boolean
  motivo: string
}

export type DatosJornada = {
  empleadoId: string | null
  desde: FechaIso
  hasta: FechaIso | null
  horasSemanalesMin: number
  horasDiariasMin: number | null
}

export type RepositorioCalendario = {
  listar(empresaId: string): Promise<CalendarioResumen[]>
  obtener(id: string): Promise<CalendarioCompleto | null>
  obtenerPredeterminado(empresaId: string): Promise<CalendarioCompleto | null>
  /** Calendario asignado al empleado en la fecha, con caída al predeterminado. */
  calendarioDeEmpleado(empleadoId: string, fecha: FechaIso): Promise<CalendarioCompleto | null>
  crear(empresaId: string, datos: DatosCalendario): Promise<string>
  actualizar(id: string, datos: DatosCalendario): Promise<number>
  alternar(id: string, activo: boolean): Promise<void>
  crearFestivos(calendarioId: string, festivos: readonly DatosFestivo[]): Promise<number>
  actualizarFestivo(calendarioId: string, festivoId: string, datos: DatosFestivo): Promise<void>
  eliminarFestivo(calendarioId: string, festivoId: string): Promise<void>
  crearExcepcion(calendarioId: string, datos: DatosExcepcion): Promise<void>
  eliminarExcepcion(calendarioId: string, excepcionId: string): Promise<void>
  crearJornada(calendarioId: string, datos: DatosJornada): Promise<void>
  eliminarJornada(calendarioId: string, jornadaId: string): Promise<void>
  asignarEmpleado(
    empleadoId: string,
    calendarioId: string,
    desde: FechaIso,
  ): Promise<void>
  quitarAsignacion(asignacionId: string): Promise<void>
  listarAsignaciones(empresaId: string): Promise<AsignacionCalendario[]>
  /** Parte aprobados cuya semana contiene la fecha (protege el borrado de un festivo). */
  contarPartesAprobadosEnFecha(calendarioId: string, fecha: FechaIso): Promise<number>
  versionDe(calendarioId: string): Promise<number | null>
  perteneceAEmpresa(calendarioId: string, empresaId: string): Promise<boolean>
}

/** Vista resuelta que consume el módulo de partes. */
export type CalendarioAplicado = {
  calendarioId: string
  version: number
  resuelto: CalendarioResuelto
  horasSemanalesMin: number | null
}
