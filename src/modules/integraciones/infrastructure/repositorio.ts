import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  apiIdempotencia,
  apiKey,
  apiRateLimit,
  asignacion,
  imputacion,
  outbox,
  parte,
  proyecto,
  tarea,
  webhook,
  webhookEntrega,
} from '@/db/schema'
import { AppError } from '@/shared/errors'
import { semanaIsoDe } from '@/modules/partes/domain/fechas'
import { normalizarAlcances, normalizarEventos } from '../domain/api'
import type {
  ClaveGuardada,
  ClaveListado,
  EntregaListado,
  EntregaPendiente,
  OutboxPendiente,
  ReclamoIdempotencia,
  RegistroIdempotencia,
  RepositorioIntegraciones,
  WebhookListado,
} from '../application/ports'

export const repositorioIntegraciones: RepositorioIntegraciones = {
  async crearClave(datos) {
    const filas = await db
      .insert(apiKey)
      .values({
        empresaId: datos.empresaId,
        nombre: datos.nombre,
        prefijo: datos.prefijo,
        hash: datos.hash,
        alcances: datos.alcances,
        caducaAt: datos.caducaAt,
      })
      .returning({ id: apiKey.id })

    const creada = filas[0]
    if (!creada) throw new AppError('ERROR_INTERNO', 'No se pudo crear la clave')
    return creada.id
  },

  async clavePorPrefijo(prefijo): Promise<ClaveGuardada | null> {
    const filas = await db
      .select({
        id: apiKey.id,
        empresaId: apiKey.empresaId,
        activo: apiKey.activo,
        caducaAt: apiKey.caducaAt,
        hash: apiKey.hash,
        alcances: apiKey.alcances,
      })
      .from(apiKey)
      .where(eq(apiKey.prefijo, prefijo))
      .limit(1)

    const fila = filas[0]
    if (!fila) return null
    return { ...fila, alcances: normalizarAlcances(fila.alcances) }
  },

  async marcarUso(id, fecha) {
    await db.update(apiKey).set({ ultimoUsoAt: fecha }).where(eq(apiKey.id, id))
  },

  async consumirLimite(apiKeyId, ventana, maximo) {
    const filas = await db
      .insert(apiRateLimit)
      .values({ apiKeyId, ventana, contador: 1 })
      .onConflictDoUpdate({
        target: [apiRateLimit.apiKeyId, apiRateLimit.ventana],
        set: { contador: sql`${apiRateLimit.contador} + 1` },
        setWhere: sql`${apiRateLimit.contador} < ${maximo}`,
      })
      .returning({ contador: apiRateLimit.contador })

    return filas.length > 0
  },

  async listarClaves(empresaId): Promise<ClaveListado[]> {
    const filas = await db
      .select({
        id: apiKey.id,
        nombre: apiKey.nombre,
        prefijo: apiKey.prefijo,
        alcances: apiKey.alcances,
        activo: apiKey.activo,
        caducaAt: apiKey.caducaAt,
        ultimoUsoAt: apiKey.ultimoUsoAt,
        createdAt: apiKey.createdAt,
      })
      .from(apiKey)
      .where(eq(apiKey.empresaId, empresaId))
      .orderBy(desc(apiKey.createdAt))

    return filas.map((fila) => ({ ...fila, alcances: normalizarAlcances(fila.alcances) }))
  },

  async revocarClave(empresaId, id) {
    const filas = await db
      .update(apiKey)
      .set({ activo: false })
      .where(and(eq(apiKey.id, id), eq(apiKey.empresaId, empresaId)))
      .returning({ id: apiKey.id })
    return filas.length > 0
  },

  async crearWebhook(datos) {
    const filas = await db
      .insert(webhook)
      .values({
        empresaId: datos.empresaId,
        nombre: datos.nombre,
        url: datos.url,
        secreto: datos.secreto,
        eventos: datos.eventos,
      })
      .returning({ id: webhook.id })

    const creado = filas[0]
    if (!creado) throw new AppError('ERROR_INTERNO', 'No se pudo crear el webhook')
    return creado.id
  },

  async listarWebhooks(empresaId): Promise<WebhookListado[]> {
    const filas = await db
      .select({
        id: webhook.id,
        nombre: webhook.nombre,
        url: webhook.url,
        eventos: webhook.eventos,
        activo: webhook.activo,
        createdAt: webhook.createdAt,
      })
      .from(webhook)
      .where(eq(webhook.empresaId, empresaId))
      .orderBy(desc(webhook.createdAt))

    return filas.map((fila) => ({ ...fila, eventos: normalizarEventos(fila.eventos) }))
  },

  async cambiarEstadoWebhook(empresaId, id, activo) {
    const filas = await db
      .update(webhook)
      .set({ activo })
      .where(and(eq(webhook.id, id), eq(webhook.empresaId, empresaId)))
      .returning({ id: webhook.id })
    return filas.length > 0
  },

  async webhooksPara(empresaId, evento) {
    return db
      .select({ id: webhook.id })
      .from(webhook)
      .where(
        and(
          eq(webhook.empresaId, empresaId),
          eq(webhook.activo, true),
          sql`${evento} = any(${webhook.eventos})`,
        ),
      )
  },

  async outboxPendientes(limite): Promise<OutboxPendiente[]> {
    const filas = await db
      .select({
        id: outbox.id,
        empresaId: outbox.empresaId,
        evento: outbox.evento,
        payload: outbox.payload,
      })
      .from(outbox)
      .where(isNull(outbox.procesadoAt))
      .orderBy(asc(outbox.createdAt))
      .limit(limite)

    return filas.flatMap((fila) => {
      const eventos = normalizarEventos([fila.evento])
      const evento = eventos[0]
      if (!evento) {
        console.error('[outbox] evento desconocido, se omite', fila.id, fila.evento)
        return []
      }
      return [
        {
          id: fila.id,
          empresaId: fila.empresaId,
          evento,
          payload: (fila.payload ?? {}) as Record<string, unknown>,
        },
      ]
    })
  },

  async marcarOutboxProcesado(id, fecha) {
    await db.update(outbox).set({ procesadoAt: fecha }).where(eq(outbox.id, id))
  },

  async crearEntrega(datos) {
    await db
      .insert(webhookEntrega)
      .values({
        webhookId: datos.webhookId,
        outboxId: datos.outboxId,
        evento: datos.evento,
        payload: datos.payload,
      })
      .onConflictDoNothing({ target: [webhookEntrega.webhookId, webhookEntrega.outboxId] })
  },

  async entregasPendientes(ahora, limite): Promise<EntregaPendiente[]> {
    const filas = await db
      .select({
        id: webhookEntrega.id,
        webhookUrl: webhook.url,
        webhookSecreto: webhook.secreto,
        evento: webhookEntrega.evento,
        payload: webhookEntrega.payload,
        intentos: webhookEntrega.intentos,
      })
      .from(webhookEntrega)
      .innerJoin(webhook, eq(webhookEntrega.webhookId, webhook.id))
      .where(
        and(
          inArray(webhookEntrega.estado, ['PENDIENTE', 'FALLIDO']),
          eq(webhook.activo, true),
          or(
            isNull(webhookEntrega.proximoIntentoAt),
            lte(webhookEntrega.proximoIntentoAt, ahora),
          ),
        ),
      )
      .orderBy(asc(webhookEntrega.createdAt))
      .limit(limite)

    return filas.map((fila) => ({
      ...fila,
      payload: (fila.payload ?? {}) as Record<string, unknown>,
    }))
  },

  async marcarEntregaEnviada(id, fecha) {
    await db
      .update(webhookEntrega)
      .set({ estado: 'ENVIADO', enviadoAt: fecha, ultimoError: null })
      .where(eq(webhookEntrega.id, id))
  },

  async marcarEntregaFallida(id, mensaje, proximoIntentoAt, agotada) {
    await db
      .update(webhookEntrega)
      .set({
        estado: agotada ? 'AGOTADO' : 'FALLIDO',
        intentos: sql`${webhookEntrega.intentos} + 1`,
        ultimoError: mensaje.slice(0, 500),
        proximoIntentoAt,
      })
      .where(eq(webhookEntrega.id, id))
  },

  async listarEntregas(empresaId, limite): Promise<EntregaListado[]> {
    return db
      .select({
        id: webhookEntrega.id,
        webhookNombre: webhook.nombre,
        evento: webhookEntrega.evento,
        estado: webhookEntrega.estado,
        intentos: webhookEntrega.intentos,
        ultimoError: webhookEntrega.ultimoError,
        enviadoAt: webhookEntrega.enviadoAt,
        createdAt: webhookEntrega.createdAt,
      })
      .from(webhookEntrega)
      .innerJoin(webhook, eq(webhookEntrega.webhookId, webhook.id))
      .where(eq(webhook.empresaId, empresaId))
      .orderBy(desc(webhookEntrega.createdAt))
      .limit(limite)
  },

  async reclamarIdempotencia(datos: RegistroIdempotencia): Promise<ReclamoIdempotencia> {
    const insertadas = await db
      .insert(apiIdempotencia)
      .values(datos)
      .onConflictDoNothing({
        target: [apiIdempotencia.apiKeyId, apiIdempotencia.clave],
      })
      .returning({ id: apiIdempotencia.id, respuesta: apiIdempotencia.respuesta })

    const creada = insertadas[0]
    if (creada) return { ...creada, reclamada: true }

    const filas = await db
      .select({ id: apiIdempotencia.id, respuesta: apiIdempotencia.respuesta })
      .from(apiIdempotencia)
      .where(
        and(
          eq(apiIdempotencia.apiKeyId, datos.apiKeyId),
          eq(apiIdempotencia.clave, datos.clave),
        ),
      )
      .limit(1)

    const existente = filas[0]
    if (!existente) throw new AppError('ERROR_INTERNO', 'No se pudo registrar la idempotencia')
    return { ...existente, reclamada: false }
  },

  async guardarRespuestaIdempotencia(id, respuesta) {
    await db.update(apiIdempotencia).set({ respuesta }).where(eq(apiIdempotencia.id, id))
  },

  async liberarIdempotencia(id) {
    await db.delete(apiIdempotencia).where(eq(apiIdempotencia.id, id))
  },

  async escribirImputacion(datos) {
    if (!Number.isInteger(datos.minutos) || datos.minutos < 1 || datos.minutos > 1440) {
      throw new AppError('VALIDACION', 'Los minutos deben ser un entero entre 1 y 1440')
    }

    const semana = semanaIsoDe(datos.fecha)

    return db.transaction(async (tx) => {
      const existente = (
        await tx
          .select()
          .from(parte)
          .where(
            and(
              eq(parte.empleadoId, datos.empleadoId),
              eq(parte.isoYear, semana.isoYear),
              eq(parte.isoWeek, semana.isoWeek),
            ),
          )
          .for('update')
          .limit(1)
      )[0]

      let actual = existente
      if (!actual) {
        const creados = await tx
          .insert(parte)
          .values({
            empresaId: datos.empresaId,
            empleadoId: datos.empleadoId,
            isoYear: semana.isoYear,
            isoWeek: semana.isoWeek,
            weekStart: semana.weekStart,
            estado: 'BORRADOR',
            totalMinutos: 0,
            version: 1,
          })
          .onConflictDoNothing({ target: [parte.empleadoId, parte.isoYear, parte.isoWeek] })
          .returning()

        actual = creados[0]
        if (!actual) {
          throw new AppError('CONFLICTO_VERSION', 'El parte se está creando; reintenta la petición')
        }
      }

      if (actual.estado !== 'BORRADOR' && actual.estado !== 'RECHAZADO') {
        throw new AppError(
          'ESTADO_INVALIDO',
          `El parte está en estado ${actual.estado} y no admite imputaciones por API`,
        )
      }

      const asignada = await tx
        .select({ id: asignacion.id })
        .from(asignacion)
        .innerJoin(tarea, eq(tarea.id, asignacion.tareaId))
        .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
        .where(
          and(
            eq(asignacion.empleadoId, datos.empleadoId),
            eq(asignacion.tareaId, datos.tareaId),
            eq(asignacion.activa, true),
            lte(asignacion.desde, datos.fecha),
            or(isNull(asignacion.hasta), sql`${asignacion.hasta} >= ${datos.fecha}`),
            eq(tarea.activa, true),
            eq(proyecto.empresaId, datos.empresaId),
          ),
        )
        .limit(1)

      if (asignada.length === 0) {
        throw new AppError(
          'SIN_PERMISO',
          'La tarea no está asignada al empleado para esa fecha',
        )
      }

      const filas = await tx
        .insert(imputacion)
        .values({
          parteId: actual.id,
          fecha: datos.fecha,
          tareaId: datos.tareaId,
          minutos: datos.minutos,
        })
        .onConflictDoUpdate({
          target: [imputacion.parteId, imputacion.fecha, imputacion.tareaId],
          set: { minutos: datos.minutos },
        })
        .returning({ id: imputacion.id })

      const guardada = filas[0]
      if (!guardada) throw new AppError('ERROR_INTERNO', 'No se pudo guardar la imputación')

      const total = (
        await tx
          .select({
            total: sql<number>`coalesce(sum(${imputacion.minutos}), 0)::int`,
          })
          .from(imputacion)
          .where(eq(imputacion.parteId, actual.id))
      )[0]?.total ?? 0

      const version = actual.version + 1
      await tx
        .update(parte)
        .set({ totalMinutos: total, version, updatedAt: new Date() })
        .where(eq(parte.id, actual.id))

      return {
        parteId: actual.id,
        imputacionId: guardada.id,
        totalMinutos: total,
        version,
      }
    })
  },
}
