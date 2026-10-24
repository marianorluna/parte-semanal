/**
 * Casos de uso de la API pública y los webhooks. La autenticación de claves,
 * el despacho del outbox y la entrega firmada viven aquí; los adaptadores
 * (Drizzle, fetch) se inyectan desde composición.
 */

import { AppError } from '@/shared/errors'
import {
  claveIdempotenciaValida,
  claveVigente,
  extraerPrefijo,
  LIMITE_POR_MINUTO,
  normalizarAlcances,
  normalizarEventos,
  tieneAlcance,
  urlWebhookValida,
  ventanaMinuto,
  type Alcance,
} from '../domain/api'
import { compararSeguro, entregaAgotada, firmarWebhook, proximoIntento } from '../domain/firma'
import type { DepsIntegraciones, EntregaPendiente, OutboxPendiente } from './ports'

export type ContextoApi = {
  apiKeyId: string
  empresaId: string
  alcances: Alcance[]
}

const LIMITE_OUTBOX = 50
const LIMITE_ENTREGAS = 50

function tokenBearer(authorization: string | null): string {
  if (!authorization) return ''
  const [esquema, valor] = authorization.split(' ', 2)
  if (esquema?.toLowerCase() !== 'bearer' || !valor) return ''
  return valor.trim()
}

/**
 * Valida la clave, consume rate limit y comprueba el alcance. Cualquier fallo
 * de autenticación responde igual: no se revela si el prefijo existe.
 */
export async function autenticarApi(
  deps: DepsIntegraciones,
  authorization: string | null,
  requerido: Alcance,
): Promise<ContextoApi> {
  const clave = tokenBearer(authorization)
  const prefijo = clave ? extraerPrefijo(clave) : null
  if (!prefijo) throw new AppError('NO_AUTENTICADO', 'Clave de API no válida')

  const guardada = await deps.repo.clavePorPrefijo(prefijo)
  if (!guardada || !claveVigente(guardada, deps.ahora())) {
    throw new AppError('NO_AUTENTICADO', 'Clave de API no válida o caducada')
  }

  if (!compararSeguro(deps.hashClave(clave), guardada.hash)) {
    throw new AppError('NO_AUTENTICADO', 'Clave de API no válida')
  }

  if (!tieneAlcance(guardada.alcances, requerido)) {
    throw new AppError('SIN_PERMISO', `La clave no tiene el alcance ${requerido}`)
  }

  const ahora = deps.ahora()
  const permitido = await deps.repo.consumirLimite(
    guardada.id,
    ventanaMinuto(ahora),
    LIMITE_POR_MINUTO,
  )
  if (!permitido) {
    throw new AppError(
      'DEMASIADAS_PETICIONES',
      `Límite de ${LIMITE_POR_MINUTO} peticiones por minuto superado`,
    )
  }

  await deps.repo.marcarUso(guardada.id, ahora)

  return { apiKeyId: guardada.id, empresaId: guardada.empresaId, alcances: guardada.alcances }
}

export async function crearClaveApi(
  deps: DepsIntegraciones,
  empresaId: string,
  input: { nombre: string; alcances: string[]; caducaAt?: Date | null },
): Promise<{ id: string; clave: string; prefijo: string }> {
  const nombre = input.nombre.trim()
  if (nombre.length < 3 || nombre.length > 80) {
    throw new AppError('VALIDACION', 'El nombre debe tener entre 3 y 80 caracteres')
  }

  const alcances = normalizarAlcances(input.alcances)
  if (alcances.length === 0) {
    throw new AppError('VALIDACION', 'Selecciona al menos un alcance')
  }

  if (input.caducaAt && input.caducaAt.getTime() <= deps.ahora().getTime()) {
    throw new AppError('VALIDACION', 'La fecha de caducidad debe estar en el futuro')
  }

  const credenciales = deps.generarCredenciales()
  const id = await deps.repo.crearClave({
    empresaId,
    nombre,
    prefijo: credenciales.prefijo,
    hash: deps.hashClave(credenciales.clave),
    alcances,
    caducaAt: input.caducaAt ?? null,
  })

  return { id, clave: credenciales.clave, prefijo: credenciales.prefijo }
}

export function listarClavesApi(deps: DepsIntegraciones, empresaId: string) {
  return deps.repo.listarClaves(empresaId)
}

export async function revocarClaveApi(
  deps: DepsIntegraciones,
  empresaId: string,
  claveId: string,
): Promise<void> {
  const revocada = await deps.repo.revocarClave(empresaId, claveId)
  if (!revocada) throw new AppError('NO_ENCONTRADO', 'La clave no existe')
}

export async function crearWebhook(
  deps: DepsIntegraciones,
  empresaId: string,
  input: { nombre: string; url: string; eventos: string[] },
  permitirHttp: boolean,
): Promise<{ id: string; secreto: string }> {
  const nombre = input.nombre.trim()
  if (nombre.length < 3 || nombre.length > 80) {
    throw new AppError('VALIDACION', 'El nombre debe tener entre 3 y 80 caracteres')
  }
  if (!urlWebhookValida(input.url, permitirHttp)) {
    throw new AppError(
      'VALIDACION',
      permitirHttp ? 'La URL debe ser http o https' : 'La URL debe usar https',
    )
  }

  const eventos = normalizarEventos(input.eventos)
  if (eventos.length === 0) {
    throw new AppError('VALIDACION', 'Selecciona al menos un evento')
  }

  const secreto = deps.generarSecretoWebhook()
  const id = await deps.repo.crearWebhook({
    empresaId,
    nombre,
    url: input.url.trim(),
    secreto,
    eventos,
  })
  return { id, secreto }
}

export function listarWebhooks(deps: DepsIntegraciones, empresaId: string) {
  return deps.repo.listarWebhooks(empresaId)
}

export async function cambiarEstadoWebhook(
  deps: DepsIntegraciones,
  empresaId: string,
  webhookId: string,
  activo: boolean,
): Promise<void> {
  const cambiado = await deps.repo.cambiarEstadoWebhook(empresaId, webhookId, activo)
  if (!cambiado) throw new AppError('NO_ENCONTRADO', 'El webhook no existe')
}

export function listarEntregas(deps: DepsIntegraciones, empresaId: string) {
  return deps.repo.listarEntregas(empresaId, LIMITE_ENTREGAS)
}

export function reclamarIdempotencia(
  deps: DepsIntegraciones,
  datos: { apiKeyId: string; clave: string; metodo: string; ruta: string },
) {
  if (!claveIdempotenciaValida(datos.clave)) {
    throw new AppError(
      'VALIDACION',
      'La cabecera Idempotency-Key es obligatoria (entre 8 y 128 caracteres)',
    )
  }
  return deps.repo.reclamarIdempotencia(datos)
}

export function guardarRespuestaIdempotencia(
  deps: DepsIntegraciones,
  id: string,
  respuesta: unknown,
): Promise<void> {
  return deps.repo.guardarRespuestaIdempotencia(id, respuesta)
}

export function liberarIdempotencia(deps: DepsIntegraciones, id: string): Promise<void> {
  return deps.repo.liberarIdempotencia(id)
}

/**
 * Convierte cada evento pendiente del outbox en una entrega por webhook. Es
 * idempotente por (webhook, outbox): repetir el despacho no duplica envíos.
 */
export async function procesarOutbox(
  deps: DepsIntegraciones,
  limite = LIMITE_OUTBOX,
): Promise<{ procesados: number; entregas: number }> {
  const pendientes = await deps.repo.outboxPendientes(limite)
  let procesados = 0
  let entregas = 0

  for (const evento of pendientes) {
    try {
      const destinos = await deps.repo.webhooksPara(evento.empresaId, evento.evento)
      for (const destino of destinos) {
        await deps.repo.crearEntrega({
          webhookId: destino.id,
          outboxId: evento.id,
          evento: evento.evento,
          payload: evento.payload,
        })
        entregas += 1
      }

      await deps.repo.marcarOutboxProcesado(evento.id, deps.ahora())
      procesados += 1
    } catch (error) {
      // La fila sigue pendiente: el siguiente despacho la reintenta.
      console.error('[outbox] no se pudo despachar', evento.id, error)
    }
  }

  return { procesados, entregas }
}

function cuerpoEntrega(entrega: EntregaPendiente, ahora: Date): string {
  return JSON.stringify({
    id: entrega.id,
    evento: entrega.evento,
    ocurridoEn: ahora.toISOString(),
    datos: entrega.payload,
  })
}

/**
 * Entrega las pendientes cuyo `proximoIntentoAt` ya venció. Un webhook caído
 * no afecta a la transacción de negocio: solo acumula intentos y backoff.
 */
export async function entregarPendientes(
  deps: DepsIntegraciones,
  limite = LIMITE_ENTREGAS,
): Promise<{ enviadas: number; fallidas: number; agotadas: number }> {
  const ahora = deps.ahora()
  const pendientes = await deps.repo.entregasPendientes(ahora, limite)
  const resumen = { enviadas: 0, fallidas: 0, agotadas: 0 }

  for (const entrega of pendientes) {
    const timestamp = Math.floor(ahora.getTime() / 1000)
    const cuerpo = cuerpoEntrega(entrega, ahora)
    const firma = firmarWebhook(entrega.webhookSecreto, timestamp, cuerpo)

    const resultado = await deps.enviarWebhook(entrega, firma, timestamp, cuerpo)
    if (resultado.ok) {
      await deps.repo.marcarEntregaEnviada(entrega.id, ahora)
      resumen.enviadas += 1
      continue
    }

    const intentos = entrega.intentos + 1
    const agotada = entregaAgotada(intentos)
    await deps.repo.marcarEntregaFallida(
      entrega.id,
      resultado.mensaje,
      proximoIntento(intentos, ahora),
      agotada,
    )
    if (agotada) resumen.agotadas += 1
    else resumen.fallidas += 1
  }

  return resumen
}

/** Despacho periódico: outbox nuevo y reintentos vencidos en una pasada. */
export async function despacharWebhooks(
  deps: DepsIntegraciones,
): Promise<{ outbox: number; enviadas: number; fallidas: number; agotadas: number }> {
  const outbox = await procesarOutbox(deps)
  const entregas = await entregarPendientes(deps)
  return {
    outbox: outbox.procesados,
    enviadas: entregas.enviadas,
    fallidas: entregas.fallidas,
    agotadas: entregas.agotadas,
  }
}

/** Encola un evento en el outbox dentro de una transacción existente. */
export type RegistroOutbox = {
  empresaId: string
  agregado: string
  agregadoId: string
  evento: OutboxPendiente['evento']
  payload: Record<string, unknown>
}
