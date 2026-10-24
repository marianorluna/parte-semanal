import type { Rango, TipoPeriodo } from '../domain/cierre'

export type PeriodoCerradoListado = {
  id: string
  tipo: TipoPeriodo
  empleadoId: string | null
  empleadoNombre: string | null
  empleadoCodigo: string | null
  isoYear: number | null
  isoWeek: number | null
  anio: number
  mes: number | null
  desde: string
  hasta: string
  motivo: string | null
  partesBloqueados: number
  cerradoPorNombre: string | null
  createdAt: Date
  reabiertoAt: Date | null
  reabiertoPorNombre: string | null
  motivoReapertura: string | null
  activo: boolean
}

export type DatosPeriodo = Rango & {
  empresaId: string
  tipo: TipoPeriodo
  empleadoId: string | null
  isoYear: number | null
  isoWeek: number | null
  anio: number
  mes: number | null
  motivo: string | null
}

export type RepositorioCierre = {
  listar(empresaId: string): Promise<PeriodoCerradoListado[]>
  obtener(periodoId: string, empresaId: string): Promise<PeriodoCerradoListado | null>
  /**
   * Periodos activos del mismo tipo y ámbito que solapan el rango. Un cierre
   * semanal nuevo no debe repetir la misma semana; el mensual tampoco el mes.
   */
  solapesActivos(datos: DatosPeriodo): Promise<Rango[]>
  /** Inserta el periodo y bloquea los partes aprobados de su ámbito. */
  cerrar(datos: DatosPeriodo, actorId: string): Promise<{ id: string; partesBloqueados: number }>
  /**
   * Marca el periodo como reabierto y devuelve a APROBADO los partes que ya no
   * estén cubiertos por otro cierre activo.
   */
  reabrir(
    periodoId: string,
    empresaId: string,
    actorId: string,
    motivo: string,
  ): Promise<{ partesDesbloqueados: string[] }>
  /** Rangos de cierre vigentes que afectan al empleado (o a toda la empresa). */
  periodosActivos(empresaId: string, empleadoId: string): Promise<Rango[]>
  empleadoPerteneceAEmpresa(empleadoId: string, empresaId: string): Promise<boolean>
}
