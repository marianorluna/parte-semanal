import type { EstadoParte, Rol } from '@/db/schema'
import type { FechaIso, SemanaIso } from '../domain/fechas'
import type { ImputacionEntrada } from '../domain/parte'

export type ParteResumen = {
  id: string
  empresaId: string
  empleadoId: string
  isoYear: number
  isoWeek: number
  weekStart: FechaIso
  estado: EstadoParte
  totalMinutos: number
  version: number
  enviadoAt: Date | null
  revisadoPor: string | null
  revisadoAt: Date | null
  motivoRechazo: string | null
}

export type ImputacionGuardada = {
  id: string
  fecha: FechaIso
  tareaId: string
  minutos: number
  nota: string | null
}

export type ParteCompleto = ParteResumen & {
  imputaciones: ImputacionGuardada[]
}

export type TareaAsignada = {
  proyectoId: string
  proyectoCodigo: string
  proyectoNombre: string
  tareaId: string
  tareaCodigo: string
  tareaNombre: string
}

/** Día resuelto del calendario laboral, listo para la rejilla y la validación. */
export type DiaCalendarioParte = {
  fecha: FechaIso
  diaSemana: number
  laborable: boolean
  /** Texto ya formateado para la interfaz: `Fin de semana`, `Festivo: ...`. */
  motivo: string | null
  /** Festivo real (no fin de semana): habilita las reglas FESTIVO. */
  esFestivo: boolean
  horasTeoricasMin: number | null
  /** Ausencia aprobada del día; la jornada completa ya marca `laborable: false`. */
  ausencia: { id: string; nombre: string; minutos: number | null } | null
}

export type CalendarioSemana = {
  calendarioId: string | null
  calendarioVersion: number | null
  dias: DiaCalendarioParte[]
  capacidadMin: number | null
  porDefecto: boolean
}

export type ParteEnLista = ParteResumen & {
  empleadoNombre: string
  empleadoCodigo: string
  revisadoPorNombre: string | null
}

export type FiltrosControl = {
  empresaId: string
  isoYear: number
  isoWeek: number
  estado?: EstadoParte
  proyectoId?: string
  empleadoId?: string
  /** null = sin restricción (ADMIN). */
  proyectosPermitidos: string[] | null
  /** El encargado solo revisa partes de usuarios TRABAJADOR. */
  soloTrabajadores: boolean
  pagina: number
  porPagina: number
}

export type ResultadoControl = {
  filas: ParteEnLista[]
  total: number
  totalMinutos: number
}

export type RepositorioPartes = {
  buscarPorSemana(empleadoId: string, isoYear: number, isoWeek: number): Promise<ParteCompleto | null>
  crearBorrador(
    empresaId: string,
    empleadoId: string,
    semana: SemanaIso,
  ): Promise<ParteCompleto>
  guardarBorrador(parteId: string, versionEsperada: number, filas: ImputacionEntrada[]): Promise<number>
  enviar(
    parteId: string,
    versionEsperada: number,
    actorId: string,
    calendario?: { id: string | null; version: number | null },
  ): Promise<void>
  aprobar(parteId: string, versionEsperada: number, actorId: string): Promise<void>
  rechazar(parteId: string, versionEsperada: number, actorId: string, motivo: string): Promise<void>
  reabrir(parteId: string, versionEsperada: number, actorId: string, motivo: string): Promise<void>
  obtenerDetalle(parteId: string): Promise<ParteCompleto | null>
  tareasPorIds(ids: string[]): Promise<TareaAsignada[]>
  tareasAsignadas(empleadoId: string, desde: FechaIso, hasta: FechaIso): Promise<TareaAsignada[]>
  listarParaControl(filtros: FiltrosControl): Promise<ResultadoControl>
  contarPendientes(
    empresaId: string,
    proyectosPermitidos: string[] | null,
    opciones?: { soloTrabajadores?: boolean },
  ): Promise<number>
  proyectosDeEmpleado(empleadoId: string): Promise<string[]>
  rolDeEmpleado(empleadoId: string): Promise<Rol | null>
}
