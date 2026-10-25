import type { EstadoAusencia } from '../domain/ausencia'

export type TipoAusenciaResumen = {
  id: string
  empresaId: string
  codigo: string
  nombre: string
  computaSaldo: boolean
  requiereAprobacion: boolean
  activo: boolean
}

export type DatosTipoAusencia = {
  codigo: string
  nombre: string
  computaSaldo: boolean
  requiereAprobacion: boolean
}

export type AusenciaListada = {
  id: string
  empresaId: string
  empleadoId: string
  empleadoNombre: string
  empleadoCodigo: string
  tipoId: string
  tipoNombre: string
  computaSaldo: boolean
  desde: string
  hasta: string
  minutos: number | null
  estado: EstadoAusencia
  motivoSolicitud: string | null
  motivoResolucion: string | null
  resueltoPorNombre: string | null
  resueltoAt: Date | null
  createdAt: Date
}

export type DatosSolicitud = {
  tipoId: string
  desde: string
  hasta: string
  minutos: number | null
  motivo: string | null
}

export type FiltrosAusencias = {
  empresaId: string
  empleadoId?: string
  estado?: EstadoAusencia
  /** El encargado solo ve solicitudes de empleados con cuenta TRABAJADOR. */
  soloTrabajadores?: boolean
  desde?: string
  hasta?: string
}

export type SaldoGuardado = {
  id: string
  empleadoId: string
  empleadoNombre: string
  empleadoCodigo: string
  anio: number
  minutosAsignados: number
  minutosArrastrados: number
}

export type RepositorioAusencias = {
  listarTipos(empresaId: string): Promise<TipoAusenciaResumen[]>
  crearTipo(empresaId: string, datos: DatosTipoAusencia): Promise<string>
  actualizarTipo(tipoId: string, datos: DatosTipoAusencia): Promise<void>
  alternarTipo(tipoId: string, activo: boolean): Promise<void>
  obtenerTipo(tipoId: string): Promise<TipoAusenciaResumen | null>

  listar(filtros: FiltrosAusencias): Promise<AusenciaListada[]>
  obtener(ausenciaId: string): Promise<AusenciaListada | null>
  /** Crea la solicitud y rechaza solapes vigentes dentro de la transacción. */
  crear(empresaId: string, empleadoId: string, datos: DatosSolicitud): Promise<string>
  cambiarEstado(
    ausenciaId: string,
    esperado: EstadoAusencia,
    nuevo: EstadoAusencia,
    actorId: string,
    motivo: string,
  ): Promise<void>

  /** Ausencias aprobadas del empleado que tocan el rango, con el nombre del tipo. */
  aprobadasEnRango(empleadoId: string, desde: string, hasta: string): Promise<
    {
      id: string
      empleadoId: string
      desde: string
      hasta: string
      minutos: number | null
      estado: EstadoAusencia
      tipoId: string
      tipoNombre: string
    }[]
  >
  aprobadasDeEmpleado(empleadoId: string): Promise<
    {
      id: string
      empleadoId: string
      desde: string
      hasta: string
      minutos: number | null
      estado: EstadoAusencia
      tipoId: string
      tipoNombre: string
      computaSaldo: boolean
    }[]
  >

  /**
   * Ausencias aprobadas de varios empleados que tocan el rango. Pensado para
   * vistas de equipo: una sola consulta en lugar de una por persona.
   */
  aprobadasDeEmpleados(empleadoIds: string[], desde: string, hasta: string): Promise<
    {
      id: string
      empleadoId: string
      desde: string
      hasta: string
      minutos: number | null
      estado: EstadoAusencia
      tipoId: string
      tipoNombre: string
    }[]
  >

  listarSaldos(empresaId: string | null, empleadoId?: string): Promise<SaldoGuardado[]>
  perteneceAEmpresa(empleadoId: string, empresaId: string): Promise<boolean>
  guardarSaldo(
    empleadoId: string,
    anio: number,
    minutosAsignados: number,
    minutosArrastrados: number,
  ): Promise<void>
}
