import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { emailEnvio, preferenciaAviso, usuario, type EstadoEmail } from '@/db/schema'
import type {
  DatosEmail,
  EmailListado,
  EmailPendiente,
  PreferenciaAviso,
  RepositorioEmail,
} from '../application/ports'

export const repositorioEmail: RepositorioEmail = {
  async preferencias(usuarioId) {
    return db
      .select({
        tipo: preferenciaAviso.tipo,
        email: preferenciaAviso.email,
        inApp: preferenciaAviso.inApp,
      })
      .from(preferenciaAviso)
      .where(eq(preferenciaAviso.usuarioId, usuarioId))
  },

  async preferenciasDe(usuarioIds) {
    const mapa = new Map<string, PreferenciaAviso[]>()
    if (usuarioIds.length === 0) return mapa

    const filas = await db
      .select({
        usuarioId: preferenciaAviso.usuarioId,
        tipo: preferenciaAviso.tipo,
        email: preferenciaAviso.email,
        inApp: preferenciaAviso.inApp,
      })
      .from(preferenciaAviso)
      .where(inArray(preferenciaAviso.usuarioId, [...usuarioIds]))

    for (const fila of filas) {
      const lista = mapa.get(fila.usuarioId) ?? []
      lista.push({ tipo: fila.tipo, email: fila.email, inApp: fila.inApp })
      mapa.set(fila.usuarioId, lista)
    }

    return mapa
  },

  async guardarPreferencia(usuarioId, tipo, email, inApp) {
    await db
      .insert(preferenciaAviso)
      .values({ usuarioId, tipo, email, inApp })
      .onConflictDoUpdate({
        target: [preferenciaAviso.usuarioId, preferenciaAviso.tipo],
        set: { email, inApp, updatedAt: new Date() },
      })
  },

  async crearEnvio(datos: DatosEmail) {
    const creados = await db
      .insert(emailEnvio)
      .values(datos)
      .onConflictDoNothing({
        target: [emailEnvio.usuarioId, emailEnvio.claveIdempotencia],
      })
      .returning({ id: emailEnvio.id })

    return creados[0]?.id ?? null
  },

  async obtenerPendiente(emailId): Promise<EmailPendiente | null> {
    const filas = await db
      .select({
        id: emailEnvio.id,
        destinatario: emailEnvio.destinatario,
        asunto: emailEnvio.asunto,
        cuerpo: emailEnvio.cuerpo,
      })
      .from(emailEnvio)
      .where(
        and(
          eq(emailEnvio.id, emailId),
          inArray(emailEnvio.estado, ['PENDIENTE', 'FALLIDO']),
        ),
      )
      .limit(1)

    return filas[0] ?? null
  },

  async marcarEnviado(emailId) {
    await db
      .update(emailEnvio)
      .set({
        estado: 'ENVIADO',
        enviadoAt: new Date(),
        ultimoError: null,
        intentos: sql`${emailEnvio.intentos} + 1`,
      })
      .where(eq(emailEnvio.id, emailId))
  },

  async marcarFallido(emailId, mensaje) {
    await db
      .update(emailEnvio)
      .set({
        estado: 'FALLIDO',
        ultimoError: mensaje.slice(0, 500),
        intentos: sql`${emailEnvio.intentos} + 1`,
      })
      .where(eq(emailEnvio.id, emailId))
  },

  async marcarSinProveedor(emailId, mensaje) {
    await db
      .update(emailEnvio)
      .set({
        estado: 'SIN_PROVEEDOR',
        ultimoError: mensaje.slice(0, 500),
        intentos: sql`${emailEnvio.intentos} + 1`,
      })
      .where(eq(emailEnvio.id, emailId))
  },

  async listar(empresaId, limite): Promise<EmailListado[]> {
    return db
      .select({
        id: emailEnvio.id,
        usuarioNombre: usuario.nombre,
        destinatario: emailEnvio.destinatario,
        tipo: emailEnvio.tipo,
        asunto: emailEnvio.asunto,
        estado: emailEnvio.estado,
        intentos: emailEnvio.intentos,
        ultimoError: emailEnvio.ultimoError,
        enviadoAt: emailEnvio.enviadoAt,
        createdAt: emailEnvio.createdAt,
      })
      .from(emailEnvio)
      .innerJoin(usuario, eq(usuario.id, emailEnvio.usuarioId))
      .where(eq(emailEnvio.empresaId, empresaId))
      .orderBy(desc(emailEnvio.createdAt))
      .limit(limite)
  },

  async contarPorEstado(empresaId) {
    const filas = await db
      .select({
        estado: emailEnvio.estado,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(emailEnvio)
      .where(eq(emailEnvio.empresaId, empresaId))
      .groupBy(emailEnvio.estado)

    const conteo: Record<EstadoEmail, number> = {
      PENDIENTE: 0,
      ENVIADO: 0,
      FALLIDO: 0,
      SIN_PROVEEDOR: 0,
    }
    for (const fila of filas) conteo[fila.estado] = fila.total
    return conteo
  },
}
