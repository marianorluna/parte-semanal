import type { EntradaAuditoria } from '@/modules/auditoria/application/registrar'
import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import type { SemanaIso } from '@/modules/partes/domain/fechas'
import type { DatosBriefing, DatosParte } from '../domain/contexto'

/** Mensaje con el mismo contrato que espera el proveedor. */
export type MensajeLLM = {
  rol: 'sistema' | 'usuario'
  contenido: string
}

export type RespuestaLLM = {
  texto: string
  tokensEntrada: number
  tokensSalida: number
}

export type ProveedorLLM = {
  nombre: string
  disponible(): boolean
  completar(mensajes: MensajeLLM[]): Promise<RespuestaLLM>
}

/** Datos de negocio ya autorizados y listos para construir el contexto. */
export type ConsultasAsistente = {
  briefing(usuario: UsuarioSesion, semana: SemanaIso): Promise<DatosBriefing>
  parte(usuario: UsuarioSesion, parteId: string): Promise<DatosParte>
}

export type LimitadorConsumo = {
  consumir(clave: string, ahora: Date): boolean
}

export type DepsAsistente = {
  proveedor: ProveedorLLM
  consultas: ConsultasAsistente
  auditoria: (entrada: EntradaAuditoria) => Promise<void>
  limite: LimitadorConsumo
  ahora: () => Date
  /** Se evalúa en cada llamada para no validar el entorno al importar el módulo. */
  pseudonimizar: () => boolean
}

export type FuncionAsistente = 'BRIEFING' | 'MOTIVO_RECHAZO'

export type ResultadoAsistente = {
  texto: string
}
