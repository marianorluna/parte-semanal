import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import type {
  FormatoInforme,
  ParametrosInforme,
  TablaInforme,
  TipoInforme,
} from '../domain/informe'

export type DatosSolicitud = {
  tipo: TipoInforme
  formato: FormatoInforme
  parametros: unknown
}

export type InformeListado = {
  id: string
  empresaId: string
  solicitanteId: string | null
  solicitanteNombre: string | null
  tipo: TipoInforme
  formato: FormatoInforme
  parametros: Record<string, unknown>
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'FALLIDO'
  nombreArchivo: string | null
  tamanoBytes: number | null
  error: string | null
  createdAt: Date
  completadoAt: Date | null
  expiraAt: Date
}

export type InformeDescargable = {
  id: string
  empresaId: string
  nombreArchivo: string
  contenido: Buffer
  expiraAt: Date
}

export type RepositorioInformes = {
  crear(
    empresaId: string,
    solicitanteId: string,
    tipo: TipoInforme,
    formato: FormatoInforme,
    parametros: ParametrosInforme[TipoInforme],
    expiraAt: Date,
  ): Promise<string>
  listar(empresaId: string, limite?: number): Promise<InformeListado[]>
  obtener(informeId: string): Promise<InformeListado | null>
  marcarEnProceso(informeId: string): Promise<boolean>
  completar(informeId: string, nombreArchivo: string, contenido: Buffer): Promise<void>
  fallar(informeId: string, error: string): Promise<void>
  /** Vuelve a poner en cola un informe fallido; false si no estaba fallido. */
  reintentar(informeId: string, expiraAt: Date): Promise<boolean>
  contenido(informeId: string): Promise<InformeDescargable | null>
  limpiarCaducados(ahora: Date): Promise<number>
}

export type EncoladorInformes = {
  encolar(informeId: string): Promise<string | null>
}

export type ConsultasInformes = {
  certificacionMensual(empresaId: string, anio: number, mes: number): Promise<TablaInforme>
  libroJornada(empresaId: string, desde: string, hasta: string): Promise<TablaInforme>
  costesProyecto(
    empresaId: string,
    desde: string,
    hasta: string,
    proyectoId: string | null,
  ): Promise<TablaInforme>
  ausencias(empresaId: string, desde: string, hasta: string): Promise<TablaInforme>
  horasExtra(empresaId: string, desde: string, hasta: string): Promise<TablaInforme>
  auditoria(empresaId: string, desde: string, hasta: string): Promise<TablaInforme>
}

export type DepsInformes = {
  repo: RepositorioInformes
  consultas: ConsultasInformes
  encolar?: EncoladorInformes
  ahora?: () => Date
}

export type ContextoInforme = {
  usuario: UsuarioSesion
}
