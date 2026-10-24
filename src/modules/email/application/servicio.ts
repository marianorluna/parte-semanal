import type { EstadoEmail, TipoNotificacion } from '@/db/schema'
import { AppError } from '@/shared/errors'
import {
  claveEmail,
  debeEnviarEmail,
  emailValido,
  interpretarFallo,
} from '../domain/email'
import {
  construirEmail,
  escaparHtml,
  etiquetaPlantilla,
  VERSION_PLANTILLAS,
} from '../domain/plantillas'
import type {
  EmailListado,
  PreferenciaAviso,
  RepositorioEmail,
} from './ports'

export type MensajeSalida = {
  to: string
  subject: string
  text: string
  html?: string
}

export type ResultadoEnvio = { ok: true } | { ok: false; mensaje: string }

export type DepsEmail = {
  repo: RepositorioEmail
  enviar: (mensaje: MensajeSalida) => Promise<ResultadoEnvio>
  encolar: (emailId: string) => Promise<unknown>
  appUrl: string
  proveedorConfigurado: boolean
}

export type AvisoEmail = {
  empresaId: string
  usuarioId: string
  email: string
  nombre: string
  tipo: TipoNotificacion
  titulo: string
  cuerpo: string
  url: string | null
  claveIdempotencia: string
}

export type ResultadoEncolado = {
  creados: number
  duplicados: number
  omitidosPorPreferencia: number
  sinDireccionValida: number
}

const LIMITE_LISTADO = 50

export function preferenciasDe(
  deps: DepsEmail,
  usuarioId: string,
): Promise<PreferenciaAviso[]> {
  return deps.repo.preferencias(usuarioId)
}

export async function guardarPreferencia(
  deps: DepsEmail,
  usuarioId: string,
  tipo: TipoNotificacion,
  email: boolean,
  inApp: boolean,
): Promise<void> {
  await deps.repo.guardarPreferencia(usuarioId, tipo, email, inApp)
}

/**
 * Encola un correo por cada aviso in-app creado. La preferencia se consulta en
 * lote y la clave idempotente reutiliza la del aviso: repetir el cron no
 * duplica envíos. Un fallo de la cola no revierte los avisos ya creados.
 */
export async function encolarAvisos(
  deps: DepsEmail,
  avisos: readonly AvisoEmail[],
): Promise<ResultadoEncolado> {
  const resultado: ResultadoEncolado = {
    creados: 0,
    duplicados: 0,
    omitidosPorPreferencia: 0,
    sinDireccionValida: 0,
  }

  if (avisos.length === 0) return resultado

  const conDireccion = avisos.filter((aviso) => {
    const valida = emailValido(aviso.email)
    if (!valida) resultado.sinDireccionValida += 1
    return valida
  })
  if (conDireccion.length === 0) return resultado

  const preferencias = await deps.repo.preferenciasDe(
    [...new Set(conDireccion.map((aviso) => aviso.usuarioId))],
  )

  for (const aviso of conDireccion) {
    const preferencia = preferencias
      .get(aviso.usuarioId)
      ?.find((fila) => fila.tipo === aviso.tipo)

    if (!debeEnviarEmail(preferencia)) {
      resultado.omitidosPorPreferencia += 1
      continue
    }

    const mensaje = construirEmail({
      tipo: aviso.tipo,
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      url: aviso.url,
      appUrl: deps.appUrl,
      nombreDestinatario: aviso.nombre,
    })

    const emailId = await deps.repo.crearEnvio({
      empresaId: aviso.empresaId,
      usuarioId: aviso.usuarioId,
      tipo: aviso.tipo,
      destinatario: aviso.email.trim(),
      asunto: mensaje.asunto,
      cuerpo: mensaje.texto,
      plantilla: etiquetaPlantilla(aviso.tipo),
      plantillaVersion: VERSION_PLANTILLAS,
      claveIdempotencia: claveEmail(aviso.tipo, aviso.claveIdempotencia),
    })

    if (!emailId) {
      resultado.duplicados += 1
      continue
    }

    resultado.creados += 1
    try {
      await deps.encolar(emailId)
    } catch (error) {
      // El correo queda PENDIENTE en la bandeja y se puede reintentar.
      console.error('[email] no se pudo encolar', emailId, error)
    }
  }

  return resultado
}

/**
 * Envía un correo pendiente. Sin proveedor se marca SIN_PROVEEDOR (no se
 * reintenta: reintentar no arregla la configuración). Un error real se marca
 * FALLIDO y se relanza para que la cola aplique backoff.
 */
export async function procesarEmail(
  deps: DepsEmail,
  emailId: string,
): Promise<'ENVIADO' | 'SIN_PROVEEDOR' | 'OMITIDO'> {
  const pendiente = await deps.repo.obtenerPendiente(emailId)
  if (!pendiente) return 'OMITIDO'

  const html = `<p>${escaparHtml(pendiente.cuerpo).replaceAll('\n', '<br />')}</p>`
  const resultado = await deps.enviar({
    to: pendiente.destinatario,
    subject: pendiente.asunto,
    text: pendiente.cuerpo,
    html,
  })

  if (resultado.ok) {
    await deps.repo.marcarEnviado(emailId)
    return 'ENVIADO'
  }

  const interpretado = interpretarFallo(resultado.mensaje)
  if (interpretado.tipo === 'FALLIDO') {
    await deps.repo.marcarFallido(emailId, interpretado.mensaje)
    throw new Error(interpretado.mensaje)
  }

  // Cualquier otro resultado de interpretarFallo es ausencia de proveedor:
  // reintentar no lo arregla hasta que se configure SMTP_URL.
  const mensaje = 'SMTP_URL no configurado'
  await deps.repo.marcarSinProveedor(emailId, mensaje)
  return 'SIN_PROVEEDOR'
}

export function listarEnvios(deps: DepsEmail, empresaId: string): Promise<EmailListado[]> {
  return deps.repo.listar(empresaId, LIMITE_LISTADO)
}

export async function resumenEnvios(
  deps: DepsEmail,
  empresaId: string,
): Promise<Record<EstadoEmail, number>> {
  return deps.repo.contarPorEstado(empresaId)
}

/** Reintento manual de un envío fallido desde administración. */
export async function reintentarEmail(
  deps: DepsEmail,
  emailId: string,
  empresaId: string,
): Promise<void> {
  if (!emailId) throw new AppError('VALIDACION', 'Correo no indicado')
  const listado = await deps.repo.listar(empresaId, LIMITE_LISTADO)
  if (!listado.some((fila) => fila.id === emailId)) {
    throw new AppError('NO_ENCONTRADO', 'El correo no existe')
  }

  const pendiente = await deps.repo.obtenerPendiente(emailId)
  if (!pendiente) throw new AppError('ESTADO_INVALIDO', 'El correo ya se envió o no admite reintento')

  if (!deps.proveedorConfigurado) {
    throw new AppError(
      'VALIDACION',
      'No hay proveedor SMTP configurado: define SMTP_URL antes de reintentar',
    )
  }

  try {
    await deps.encolar(emailId)
  } catch {
    await procesarEmail(deps, emailId)
  }
}
