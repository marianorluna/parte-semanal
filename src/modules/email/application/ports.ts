import type { EstadoEmail, TipoNotificacion } from '@/db/schema'

export type PreferenciaAviso = {
  tipo: TipoNotificacion
  email: boolean
  inApp: boolean
}

export type DatosEmail = {
  empresaId: string
  usuarioId: string
  tipo: TipoNotificacion
  destinatario: string
  asunto: string
  cuerpo: string
  plantilla: string
  plantillaVersion: number
  claveIdempotencia: string
}

export type EmailPendiente = {
  id: string
  destinatario: string
  asunto: string
  cuerpo: string
}

export type EmailListado = {
  id: string
  usuarioNombre: string
  destinatario: string
  tipo: TipoNotificacion
  asunto: string
  estado: EstadoEmail
  intentos: number
  ultimoError: string | null
  enviadoAt: Date | null
  createdAt: Date
}

export type RepositorioEmail = {
  preferencias(usuarioId: string): Promise<PreferenciaAviso[]>
  /** Preferencias de varios usuarios en una sola consulta (cron por lotes). */
  preferenciasDe(usuarioIds: readonly string[]): Promise<Map<string, PreferenciaAviso[]>>
  guardarPreferencia(
    usuarioId: string,
    tipo: TipoNotificacion,
    email: boolean,
    inApp: boolean,
  ): Promise<void>
  /** Devuelve null si ya existía un envío con la misma clave idempotente. */
  crearEnvio(datos: DatosEmail): Promise<string | null>
  obtenerPendiente(emailId: string): Promise<EmailPendiente | null>
  marcarEnviado(emailId: string): Promise<void>
  marcarFallido(emailId: string, mensaje: string): Promise<void>
  marcarSinProveedor(emailId: string, mensaje: string): Promise<void>
  listar(empresaId: string, limite: number): Promise<EmailListado[]>
  contarPorEstado(empresaId: string): Promise<Record<EstadoEmail, number>>
}
