import type { EstadoParte, TipoNotificacion } from '@/db/schema'
import type { FechaIso, SemanaIso } from '@/modules/partes/domain/fechas'

export type NotificacionEntrada = {
  empresaId: string
  usuarioId: string
  tipo: TipoNotificacion
  titulo: string
  cuerpo: string
  url: string | null
  claveIdempotencia: string
  metadata?: Record<string, unknown> | null
}

export type NotificacionListada = {
  id: string
  tipo: TipoNotificacion
  titulo: string
  cuerpo: string
  url: string | null
  leidaAt: Date | null
  createdAt: Date
}

export type FiltrosNotificaciones = {
  soloNoLeidas: boolean
  pagina: number
  porPagina: number
}

export type ResultadoNotificaciones = {
  filas: NotificacionListada[]
  total: number
  noLeidas: number
}

export type RepositorioNotificaciones = {
  /** Inserta solo las claves nuevas; las repetidas se ignoran en silencio. */
  crearMuchas(entradas: NotificacionEntrada[]): Promise<NotificacionEntrada[]>
  listarPorUsuario(usuarioId: string, filtros: FiltrosNotificaciones): Promise<ResultadoNotificaciones>
  contarNoLeidas(usuarioId: string): Promise<number>
  marcarLeida(usuarioId: string, notificacionId: string): Promise<boolean>
  marcarTodasLeidas(usuarioId: string): Promise<number>
}

export type UsuarioAviso = {
  usuarioId: string
  email: string
  nombre: string
}

export type UsuarioPendiente = UsuarioAviso & {
  empleadoId: string
  rol: 'TRABAJADOR' | 'ENCARGADO' | 'ADMIN'
  estadoParte: EstadoParte | null
}

export type EncargadoPendiente = UsuarioAviso & {
  pendientes: number
  nombresPendientes: string[]
}

export type ProyectoConsumo = {
  proyectoId: string
  codigo: string
  nombre: string
  horasPresupuesto: number | null
  fechaInicio: FechaIso | null
  fechaFin: FechaIso | null
  minutos: number
}

export type EncargadoDeProyecto = UsuarioAviso & { proyectoId: string }

export type ConsultasAvisos = {
  listarEmpresasActivas(): Promise<{ id: string }[]>
  usuariosConPartePendiente(empresaId: string, semana: SemanaIso): Promise<UsuarioPendiente[]>
  equipoPendientePorEncargado(empresaId: string, semana: SemanaIso): Promise<EncargadoPendiente[]>
  consumoPorProyecto(empresaId: string): Promise<ProyectoConsumo[]>
  encargadosDeProyectos(proyectoIds: string[]): Promise<EncargadoDeProyecto[]>
  adminsDeEmpresa(empresaId: string): Promise<UsuarioAviso[]>
}
