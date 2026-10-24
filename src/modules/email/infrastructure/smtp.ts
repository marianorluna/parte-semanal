/**
 * Adaptador SMTP genérico. `nodemailer` se carga solo cuando hay proveedor
 * configurado: sin SMTP_URL la app funciona igual y los envíos quedan
 * SIN_PROVEEDOR, sin bloquear la transacción que originó el aviso.
 */

export type MensajeSalida = {
  to: string
  subject: string
  text: string
  html?: string
}

export type ResultadoEnvio = { ok: true } | { ok: false; mensaje: string }

type Transporte = {
  sendMail: (opciones: Record<string, unknown>) => Promise<unknown>
}

let transporte: Promise<Transporte | null> | null = null

async function crearTransporte(): Promise<Transporte | null> {
  const url = process.env.SMTP_URL?.trim()
  if (!url) return null

  const modulo = await import('nodemailer')
  const nodemailer = (modulo as unknown as { default?: { createTransport: (u: string) => Transporte } })
    .default
  if (!nodemailer) throw new Error('nodemailer no está disponible')

  return nodemailer.createTransport(url)
}

export function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_URL?.trim())
}

export async function enviarEmail(mensaje: MensajeSalida): Promise<ResultadoEnvio> {
  try {
    transporte ??= crearTransporte()
    const actual = await transporte
    if (!actual) {
      return { ok: false, mensaje: 'SMTP_URL no configurado' }
    }

    await actual.sendMail({
      from: process.env.SMTP_FROM?.trim() || 'no-reply@levitec.es',
      to: mensaje.to,
      subject: mensaje.subject,
      text: mensaje.text,
      html: mensaje.html,
    })

    return { ok: true }
  } catch (error) {
    transporte = null
    return { ok: false, mensaje: error instanceof Error ? error.message : 'Error de envío' }
  }
}
