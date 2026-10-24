import type {
  AplicaEn,
  ReglaComputo,
  ResumenComputo,
  TipoHora,
  TramoCalculado,
} from '../domain/reglas'

export type ReglaGuardada = ReglaComputo & {
  convenioId: string
}

export type ConvenioCompleto = {
  id: string
  empresaId: string
  codigo: string
  nombre: string
  activo: boolean
  version: number
  reglas: ReglaGuardada[]
}

export type ConvenioResumen = Omit<ConvenioCompleto, 'reglas'> & {
  numeroReglas: number
}

export type DatosConvenio = {
  codigo: string
  nombre: string
}

export type DatosRegla = {
  tipoHora: TipoHora
  factorBps: number
  aplicaEn: AplicaEn
  topeDiarioMin: number | null
  topeSemanalMin: number | null
  requiereAutorizacion: boolean
  prioridad: number
}

export type AsignacionConvenio = {
  id: string
  empleadoId: string
  empleadoNombre: string
  empleadoCodigo: string
  convenioId: string
  convenioNombre: string
  desde: string
  hasta: string | null
}

export type ImputacionParaComputo = {
  id: string
  fecha: string
  minutos: number
}

export type ParteParaComputo = {
  id: string
  empleadoId: string
  weekStart: string
  estado: 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'RECHAZADO' | 'BLOQUEADO'
  imputaciones: ImputacionParaComputo[]
}

export type ResultadoGuardado = TramoCalculado & {
  resultadoId: string
  parteId: string
  convenioId: string | null
  convenioVersion: number | null
}

export type RepositorioComputo = {
  listar(empresaId: string): Promise<ConvenioResumen[]>
  obtener(id: string): Promise<ConvenioCompleto | null>
  crear(empresaId: string, datos: DatosConvenio): Promise<string>
  actualizar(id: string, datos: DatosConvenio): Promise<number>
  alternar(id: string, activo: boolean): Promise<void>
  guardarRegla(convenioId: string, datos: DatosRegla): Promise<void>
  eliminarRegla(convenioId: string, reglaId: string): Promise<void>
  listarAsignaciones(empresaId: string): Promise<AsignacionConvenio[]>
  asignarEmpleado(empleadoId: string, convenioId: string, desde: string): Promise<void>
  quitarAsignacion(asignacionId: string): Promise<void>
  /** Convenio vigente del empleado en la fecha; null si no tiene asignación. */
  convenioDeEmpleado(empleadoId: string, fecha: string): Promise<ConvenioCompleto | null>
  perteneceAEmpresa(convenioId: string, empresaId: string): Promise<boolean>
  obtenerParte(parteId: string): Promise<ParteParaComputo | null>
  /** Reemplaza los resultados previos del parte en una sola transacción. */
  guardarResultados(
    parteId: string,
    convenio: { id: string; version: number } | null,
    tramos: readonly TramoCalculado[],
  ): Promise<void>
  resultadosDeParte(parteId: string): Promise<ResultadoGuardado[]>
  /** Elimina el snapshot de cómputo al reabrir el parte. */
  borrarResultados(parteId: string): Promise<void>
  contarPartesConResultados(convenioId: string): Promise<number>
}

export type ResumenParte = {
  parteId: string
  convenioId: string | null
  convenioNombre: string | null
  convenioVersion: number | null
  resumen: ResumenComputo
  tramos: ResultadoGuardado[]
}

export type { ReglaComputo, TipoHora }
