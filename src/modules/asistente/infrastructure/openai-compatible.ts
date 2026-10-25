import { z } from 'zod'
import { env } from '@/config/env'
import { AppError } from '@/shared/errors'
import type { MensajeLLM, ProveedorLLM, RespuestaLLM } from '../application/ports'

/**
 * Adaptador para cualquier proveedor que hable el protocolo de chat de OpenAI.
 * Cubre DeepSeek, OpenAI y OpenRouter: cambiar de proveedor es cambiar
 * `IA_BASE_URL` e `IA_MODELO`, sin tocar código.
 */

export type ConfiguracionProveedor = {
  apiKey: string | undefined
  baseUrl: string
  modelo: string | undefined
  timeoutMs: number
  maxTokens: number
}

const respuestaSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .optional(),
})

function errorExterno(): AppError {
  return new AppError('SERVICIO_EXTERNO', 'El asistente no está disponible en este momento')
}

/**
 * El protocolo de OpenAI solo admite los roles `system`, `user` y `assistant`.
 * El puerto los nombra en español para que el dominio no dependa del proveedor,
 * así que la traducción ocurre aquí y no en cada caso de uso.
 */
export function traducirMensajes(
  mensajes: MensajeLLM[],
): { role: 'system' | 'user'; content: string }[] {
  return mensajes.map((mensaje) => ({
    role: mensaje.rol === 'sistema' ? 'system' : 'user',
    content: mensaje.contenido,
  }))
}

/**
 * Diagnóstico en servidor sin filtrar secretos: estado HTTP y mensaje del
 * proveedor recortado. Nunca se registra la cabecera de autorización.
 */
function registrarFallo(detalle: string): void {
  console.error('[asistente-ia]', detalle.slice(0, 300))
}

function mensajeDelCuerpo(cuerpo: unknown): string {
  if (typeof cuerpo !== 'object' || cuerpo === null) return ''
  const error = (cuerpo as { error?: unknown }).error
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    const mensaje = (error as { message?: unknown }).message
    if (typeof mensaje === 'string') return mensaje
  }
  return ''
}

function urlCompletions(baseUrl: string): string {
  const limpia = baseUrl.replace(/\/+$/, '')
  // Tolerante a que se pegue la ruta completa en `IA_BASE_URL`.
  return limpia.endsWith('/chat/completions') ? limpia : `${limpia}/chat/completions`
}

function validarConfiguracion(config: ConfiguracionProveedor): void {
  const faltan = [
    config.apiKey ? null : 'IA_API_KEY',
    config.modelo ? null : 'IA_MODELO',
  ].filter((valor): valor is string => valor !== null)

  if (faltan.length > 0) {
    throw new AppError(
      'NO_CONFIGURADO',
      `El asistente de IA no está configurado: falta ${faltan.join(' y ')}`,
    )
  }
}

export function crearProveedorOpenAICompatible(config: ConfiguracionProveedor): ProveedorLLM {
  return {
    nombre: config.modelo ?? 'sin-modelo',

    disponible(): boolean {
      return Boolean(config.apiKey && config.modelo)
    },

    async completar(mensajes: MensajeLLM[]): Promise<RespuestaLLM> {
      validarConfiguracion(config)

      let respuesta: Response
      try {
        respuesta = await fetch(urlCompletions(config.baseUrl), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
            'User-Agent': 'parte-diario-ia/1',
          },
          body: JSON.stringify({
            model: config.modelo,
            messages: traducirMensajes(mensajes),
            temperature: 0.2,
            max_tokens: config.maxTokens,
            stream: false,
          }),
          signal: AbortSignal.timeout(config.timeoutMs),
        })
      } catch (error) {
        const motivo = error instanceof Error ? `${error.name}: ${error.message}` : 'error de red'
        registrarFallo(`fallo de red o timeout (${motivo})`)
        throw errorExterno()
      }

      if (!respuesta.ok) {
        let detalle = ''
        try {
          detalle = mensajeDelCuerpo(await respuesta.json())
        } catch {
          detalle = ''
        }
        registrarFallo(`HTTP ${respuesta.status}${detalle ? `: ${detalle}` : ''}`)
        throw errorExterno()
      }

      let cuerpo: unknown
      try {
        cuerpo = await respuesta.json()
      } catch {
        registrarFallo('respuesta que no es JSON')
        throw errorExterno()
      }

      const parsed = respuestaSchema.safeParse(cuerpo)
      if (!parsed.success) {
        registrarFallo('respuesta con formato inesperado')
        throw errorExterno()
      }

      const texto = parsed.data.choices[0]?.message.content ?? ''
      if (!texto.trim()) {
        registrarFallo('respuesta vacía del proveedor')
        throw errorExterno()
      }

      return {
        texto,
        tokensEntrada: parsed.data.usage?.prompt_tokens ?? 0,
        tokensSalida: parsed.data.usage?.completion_tokens ?? 0,
      }
    },
  }
}

/** Lee el entorno en cada uso; `env()` ya cachea y protege el build. */
export function crearProveedorDesdeEntorno(): ProveedorLLM {
  const desdeEntorno = (): ProveedorLLM => {
    const configuracion = env()
    return crearProveedorOpenAICompatible({
      apiKey: configuracion.IA_API_KEY,
      baseUrl: configuracion.IA_BASE_URL,
      modelo: configuracion.IA_MODELO,
      timeoutMs: configuracion.IA_TIMEOUT_MS,
      maxTokens: configuracion.IA_MAX_TOKENS,
    })
  }

  return {
    get nombre(): string {
      try {
        return desdeEntorno().nombre
      } catch {
        return 'no-configurado'
      }
    },
    disponible(): boolean {
      // Una variable opcional mal escrita no puede tumbar una pantalla: si el
      // entorno no valida, el asistente simplemente queda no disponible.
      try {
        return desdeEntorno().disponible()
      } catch {
        return false
      }
    },
    completar(mensajes: MensajeLLM[]): Promise<RespuestaLLM> {
      return desdeEntorno().completar(mensajes)
    },
  }
}
