/**
 * Adaptador HTTP de entrega de webhooks. El cuerpo y la firma se calculan antes
 * de llamar: se reenvía exactamente lo firmado, también en los reintentos.
 */

import type { ResultadoEnvioWebhook } from '../application/ports'
import type { EntregaPendiente } from '../application/ports'

const TIMEOUT_MS = 10_000

export async function enviarWebhookHttp(
  entrega: EntregaPendiente,
  firma: string,
  timestamp: number,
  cuerpo: string,
): Promise<ResultadoEnvioWebhook> {
  try {
    const respuesta = await fetch(entrega.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'parte-diario-webhooks/1',
        'X-Levitec-Evento': entrega.evento,
        'X-Levitec-Timestamp': String(timestamp),
        'X-Levitec-Firma': firma,
      },
      body: cuerpo,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!respuesta.ok) {
      return { ok: false, mensaje: `HTTP ${respuesta.status}` }
    }
    return { ok: true }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error de red'
    return { ok: false, mensaje: mensaje.slice(0, 300) }
  }
}
