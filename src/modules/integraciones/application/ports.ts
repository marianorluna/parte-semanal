import type { Alcance, Evento } from '../domain/api'

export type ClaveGuardada = {
  id: string
  empresaId: string
  activo: boolean
  caducaAt: Date | null
  hash: string
  alcances: Alcance[]
}

export type ClaveListado = {
  id: string
  nombre: string
  prefijo: string
  alcances: Alcance[]
  activo: boolean
  caducaAt: Date | null
  ultimoUsoAt: Date | null
  createdAt: Date
}

export type WebhookListado = {
  id: string
  nombre: string
  url: string
  eventos: Evento[]
  activo: boolean
  createdAt: Date
}

export type EntregaListado = {
  id: string
  webhookNombre: string
  evento: string
  estado: 'PENDIENTE' | 'ENVIADO' | 'FALLIDO' | 'AGOTADO'
  intentos: number
  ultimoError: string | null
  enviadoAt: Date | null
  createdAt: Date
}

export type OutboxPendiente = {
  id: string
  empresaId: string
  evento: Evento
  payload: Record<string, unknown>
}

export type EntregaPendiente = {
  id: string
  webhookUrl: string
  webhookSecreto: string
  evento: string
  payload: Record<string, unknown>
  intentos: number
}

export type ReclamoIdempotencia = {
  id: string
  respuesta: unknown | null
  reclamada: boolean
}

export type RegistroIdempotencia = {
  apiKeyId: string
  clave: string
  metodo: string
  ruta: string
}

export type ResultadoImputacionApi = {
  parteId: string
  imputacionId: string
  totalMinutos: number
  version: number
}

export type RepositorioIntegraciones = {
  crearClave(datos: {
    empresaId: string
    nombre: string
    prefijo: string
    hash: string
    alcances: Alcance[]
    caducaAt: Date | null
  }): Promise<string>
  clavePorPrefijo(prefijo: string): Promise<ClaveGuardada | null>
  marcarUso(id: string, fecha: Date): Promise<void>
  /** Consume una unidad de la ventana; false si ya se alcanzó el límite. */
  consumirLimite(apiKeyId: string, ventana: Date, maximo: number): Promise<boolean>
  listarClaves(empresaId: string): Promise<ClaveListado[]>
  revocarClave(empresaId: string, id: string): Promise<boolean>

  crearWebhook(datos: {
    empresaId: string
    nombre: string
    url: string
    secreto: string
    eventos: Evento[]
  }): Promise<string>
  listarWebhooks(empresaId: string): Promise<WebhookListado[]>
  cambiarEstadoWebhook(empresaId: string, id: string, activo: boolean): Promise<boolean>
  webhooksPara(empresaId: string, evento: Evento): Promise<{ id: string }[]>

  outboxPendientes(limite: number): Promise<OutboxPendiente[]>
  marcarOutboxProcesado(id: string, fecha: Date): Promise<void>
  crearEntrega(datos: {
    webhookId: string
    outboxId: string
    evento: string
    payload: Record<string, unknown>
  }): Promise<void>
  entregasPendientes(ahora: Date, limite: number): Promise<EntregaPendiente[]>
  marcarEntregaEnviada(id: string, fecha: Date): Promise<void>
  marcarEntregaFallida(
    id: string,
    mensaje: string,
    proximoIntentoAt: Date,
    agotada: boolean,
  ): Promise<void>
  listarEntregas(empresaId: string, limite: number): Promise<EntregaListado[]>

  reclamarIdempotencia(datos: RegistroIdempotencia): Promise<ReclamoIdempotencia>
  guardarRespuestaIdempotencia(id: string, respuesta: unknown): Promise<void>
  /** Libera el reclamo si el procesamiento falló y el cliente puede reintentar. */
  liberarIdempotencia(id: string): Promise<void>

  escribirImputacion(datos: {
    empresaId: string
    empleadoId: string
    fecha: string
    tareaId: string
    minutos: number
  }): Promise<ResultadoImputacionApi>
}

export type ResultadoEnvioWebhook = { ok: true } | { ok: false; mensaje: string }

export type DepsIntegraciones = {
  repo: RepositorioIntegraciones
  enviarWebhook: (
    entrega: EntregaPendiente,
    firma: string,
    timestamp: number,
    cuerpo: string,
  ) => Promise<ResultadoEnvioWebhook>
  ahora: () => Date
  generarCredenciales: () => { prefijo: string; secreto: string; clave: string }
  hashClave: (clave: string) => string
  generarSecretoWebhook: () => string
}
