import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { notificacion } from '@/db/schema'
import type {
  FiltrosNotificaciones,
  NotificacionEntrada,
  RepositorioNotificaciones,
  ResultadoNotificaciones,
} from '../application/ports'

function aListada(fila: {
  id: string
  tipo: ResultadoNotificaciones['filas'][number]['tipo']
  titulo: string
  cuerpo: string
  url: string | null
  leidaAt: Date | null
  createdAt: Date
}) {
  return {
    id: fila.id,
    tipo: fila.tipo,
    titulo: fila.titulo,
    cuerpo: fila.cuerpo,
    url: fila.url,
    leidaAt: fila.leidaAt,
    createdAt: fila.createdAt,
  }
}

export const repositorioNotificaciones: RepositorioNotificaciones = {
  async crearMuchas(entradas: NotificacionEntrada[]): Promise<NotificacionEntrada[]> {
    if (entradas.length === 0) return []

    const insertadas = await db
      .insert(notificacion)
      .values(
        entradas.map((entrada) => ({
          empresaId: entrada.empresaId,
          usuarioId: entrada.usuarioId,
          tipo: entrada.tipo,
          titulo: entrada.titulo,
          cuerpo: entrada.cuerpo,
          url: entrada.url,
          claveIdempotencia: entrada.claveIdempotencia,
          metadata: entrada.metadata ?? null,
        })),
      )
      .onConflictDoNothing({ target: [notificacion.usuarioId, notificacion.claveIdempotencia] })
      .returning({ claveIdempotencia: notificacion.claveIdempotencia, usuarioId: notificacion.usuarioId })

    const creadas = new Set(insertadas.map((fila) => `${fila.usuarioId}|${fila.claveIdempotencia}`))
    return entradas.filter((entrada) => creadas.has(`${entrada.usuarioId}|${entrada.claveIdempotencia}`))
  },

  async listarPorUsuario(
    usuarioId: string,
    filtros: FiltrosNotificaciones,
  ): Promise<ResultadoNotificaciones> {
    const donde = filtros.soloNoLeidas
      ? and(eq(notificacion.usuarioId, usuarioId), isNull(notificacion.leidaAt))
      : eq(notificacion.usuarioId, usuarioId)

    const [filas, total, noLeidas] = await Promise.all([
      db
        .select({
          id: notificacion.id,
          tipo: notificacion.tipo,
          titulo: notificacion.titulo,
          cuerpo: notificacion.cuerpo,
          url: notificacion.url,
          leidaAt: notificacion.leidaAt,
          createdAt: notificacion.createdAt,
        })
        .from(notificacion)
        .where(donde)
        .orderBy(desc(notificacion.createdAt))
        .limit(filtros.porPagina)
        .offset((filtros.pagina - 1) * filtros.porPagina),
      db.select({ total: count() }).from(notificacion).where(donde),
      db
        .select({ total: count() })
        .from(notificacion)
        .where(and(eq(notificacion.usuarioId, usuarioId), isNull(notificacion.leidaAt))),
    ])

    return {
      filas: filas.map(aListada),
      total: Number(total[0]?.total ?? 0),
      noLeidas: Number(noLeidas[0]?.total ?? 0),
    }
  },

  async contarNoLeidas(usuarioId: string): Promise<number> {
    const filas = await db
      .select({ total: count() })
      .from(notificacion)
      .where(and(eq(notificacion.usuarioId, usuarioId), isNull(notificacion.leidaAt)))

    return Number(filas[0]?.total ?? 0)
  },

  async marcarLeida(usuarioId: string, notificacionId: string): Promise<boolean> {
    const filas = await db
      .update(notificacion)
      .set({ leidaAt: new Date() })
      .where(and(eq(notificacion.id, notificacionId), eq(notificacion.usuarioId, usuarioId)))
      .returning({ id: notificacion.id })

    return filas.length > 0
  },

  async marcarTodasLeidas(usuarioId: string): Promise<number> {
    const filas = await db
      .update(notificacion)
      .set({ leidaAt: new Date() })
      .where(and(eq(notificacion.usuarioId, usuarioId), isNull(notificacion.leidaAt)))
      .returning({ id: notificacion.id })

    return filas.length
  },
}
