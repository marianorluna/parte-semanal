/**
 * Plantillas de correo versionadas. El texto y el HTML se generan desde el
 * aviso in-app ya creado, para no duplicar reglas de negocio ni redactar dos
 * veces el mismo mensaje.
 */

import type { TipoNotificacion } from '@/db/schema'
import { MARCA } from '@/config/marca'

/** Subir la versión al cambiar el formato: queda guardada en cada envío. */
export const VERSION_PLANTILLAS = 1

export type MensajeEmail = {
  asunto: string
  texto: string
  html: string
}

export type EntradaPlantilla = {
  tipo: TipoNotificacion
  titulo: string
  cuerpo: string
  url: string | null
  appUrl: string
  nombreDestinatario?: string | null
}

const ETIQUETA: Record<TipoNotificacion, string> = {
  RECORDATORIO_PARTE: 'Recordatorio de horas',
  EQUIPO_PENDIENTE: 'Resumen del equipo',
  RIESGO_PROYECTO: 'Aviso de proyecto',
}

const PIE = `Este aviso se genera automáticamente desde ${MARCA.nombre}, el parte semanal de horas.`

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Convierte una ruta interna en URL absoluta sin duplicar la barra. */
export function urlAbsoluta(appUrl: string, ruta: string | null): string | null {
  if (!ruta) return null
  if (/^https?:\/\//i.test(ruta)) return ruta
  return `${appUrl.replace(/\/+$/, '')}/${ruta.replace(/^\/+/, '')}`
}

export function construirEmail(entrada: EntradaPlantilla): MensajeEmail {
  const saludo = entrada.nombreDestinatario ? `Hola ${entrada.nombreDestinatario}:` : 'Hola:'
  const enlace = urlAbsoluta(entrada.appUrl, entrada.url)
  const asunto = `[${MARCA.nombre}] ${entrada.titulo}`

  const lineas = [saludo, '', entrada.cuerpo]
  if (enlace) lineas.push('', `Abrir en el parte semanal: ${enlace}`)
  lineas.push('', PIE)
  const texto = lineas.join('\n')

  const html = [
    `<p>${escaparHtml(saludo)}</p>`,
    `<p>${escaparHtml(entrada.cuerpo)}</p>`,
    enlace
      ? `<p><a href="${escaparHtml(enlace)}">Abrir en el parte semanal</a></p>`
      : '',
    `<hr />`,
    `<p style="color:#64748b;font-size:12px">${escaparHtml(PIE)}</p>`,
  ]
    .filter(Boolean)
    .join('')

  return { asunto, texto, html }
}

export function etiquetaPlantilla(tipo: TipoNotificacion): string {
  return ETIQUETA[tipo]
}
