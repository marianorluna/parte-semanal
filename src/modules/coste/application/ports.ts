import type { Fecha, TarifaCoste } from '../domain/coste'

export type DatosTarifa = {
  empleadoId: string | null
  categoria: string | null
  importeHoraCents: number
  desde: Fecha
  hasta: Fecha | null
  activo: boolean
}

export type TarifaListada = TarifaCoste & {
  empleadoNombre: string | null
  empleadoCodigo: string | null
}

export type PresupuestoListado = {
  id: string
  proyectoId: string
  proyectoCodigo: string
  proyectoNombre: string
  version: number
  importeCents: number
  horasPresupuesto: number | null
  motivo: string | null
  createdAt: Date
}

export type DatosPresupuesto = {
  importeCents: number
  horasPresupuesto: number | null
  motivo: string | null
}

export type LineaParaCoste = {
  imputacionId: string
  fecha: Fecha
  minutosBase: number
  /** Minutos tras el convenio; si no hay cómputo, coinciden con los base. */
  minutos: number
  tareaId: string
  proyectoId: string
}

export type ParteParaCoste = {
  id: string
  empresaId: string
  empleadoId: string
  empleadoCategoria: string | null
  estado: 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'RECHAZADO' | 'BLOQUEADO'
  lineas: LineaParaCoste[]
}

export type CosteGuardado = {
  id: string
  imputacionId: string
  fecha: Fecha
  minutos: number
  costeHoraCents: number | null
  importeCents: number
  sinTarifa: boolean
  tarifaId: string | null
  proyectoId: string
  proyectoCodigo: string
  proyectoNombre: string
  tareaNombre: string
}

export type CosteCalculado = {
  imputacionId: string
  tareaId: string
  proyectoId: string
  fecha: Fecha
  minutos: number
  costeHoraCents: number | null
  importeCents: number
  sinTarifa: boolean
  tarifaId: string | null
}

export type ResumenCosteParte = {
  parteId: string
  totalCents: number
  minutos: number
  sinTarifa: number
  lineas: CosteGuardado[]
}

export type EjecucionProyecto = {
  proyectoId: string
  codigo: string
  nombre: string
  presupuestoCents: number | null
  versionPresupuesto: number | null
  horasPresupuesto: number | null
  gastadoCents: number
  horasAprobadas: number
  lineasSinTarifa: number
}

export type FiltroInformeCoste = {
  desde: Fecha
  hasta: Fecha
  proyectoId: string | null
}

export type LineaInformeCoste = {
  fecha: Fecha
  empleadoCodigo: string
  empleadoNombre: string
  proyectoId: string
  proyectoCodigo: string
  proyectoNombre: string
  tareaCodigo: string
  tareaNombre: string
  minutos: number
  costeHoraCents: number | null
  importeCents: number
  sinTarifa: boolean
}

export type RepositorioCoste = {
  listarTarifas(empresaId: string): Promise<TarifaListada[]>
  /** Tarifas activas de la empresa, para resolver el coste de un parte. */
  tarifasActivas(empresaId: string): Promise<TarifaCoste[]>
  crearTarifa(empresaId: string, datos: DatosTarifa): Promise<string>
  actualizarTarifa(id: string, datos: DatosTarifa): Promise<void>
  eliminarTarifa(id: string): Promise<void>
  existeSolape(empresaId: string, datos: DatosTarifa, excluirId: string | null): Promise<boolean>
  perteneceTarifaAEmpresa(tarifaId: string, empresaId: string): Promise<boolean>

  listarPresupuestos(empresaId: string): Promise<PresupuestoListado[]>
  crearPresupuesto(
    proyectoId: string,
    datos: DatosPresupuesto,
    creadoPor: string,
  ): Promise<number>
  proyectoPerteneceAEmpresa(proyectoId: string, empresaId: string): Promise<boolean>

  parteParaCoste(parteId: string): Promise<ParteParaCoste | null>
  /** Sustituye el snapshot de coste del parte en una transacción. */
  guardarCostes(parteId: string, lineas: readonly CosteCalculado[]): Promise<void>
  borrarCostesDeParte(parteId: string): Promise<void>
  costesDeParte(parteId: string): Promise<CosteGuardado[]>

  ejecucionProyectos(empresaId: string, permitidos: string[] | null): Promise<EjecucionProyecto[]>
  lineasInforme(
    empresaId: string,
    filtro: FiltroInformeCoste,
    permitidos: string[] | null,
  ): Promise<LineaInformeCoste[]>
}
