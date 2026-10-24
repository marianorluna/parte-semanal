import { and, desc, eq, lt } from 'drizzle-orm'
import { db } from '@/db/client'
import { informe, usuario } from '@/db/schema'
import type {
  FormatoInforme,
  ParametrosInforme,
  TipoInforme,
} from '../domain/informe'
import type {
  InformeDescargable,
  InformeListado,
  RepositorioInformes,
} from '../application/ports'

const columnasListado = {
  id: informe.id,
  empresaId: informe.empresaId,
  solicitanteId: informe.solicitanteId,
  solicitanteNombre: usuario.nombre,
  tipo: informe.tipo,
  formato: informe.formato,
  parametros: informe.parametros,
  estado: informe.estado,
  nombreArchivo: informe.nombreArchivo,
  tamanoBytes: informe.tamanoBytes,
  error: informe.error,
  createdAt: informe.createdAt,
  completadoAt: informe.completadoAt,
  expiraAt: informe.expiraAt,
}

function normalizar(fila: {
  parametros: unknown
} & Omit<InformeListado, 'parametros'>): InformeListado {
  const parametros =
    fila.parametros && typeof fila.parametros === 'object' && !Array.isArray(fila.parametros)
      ? (fila.parametros as Record<string, unknown>)
      : {}
  return { ...fila, parametros }
}

export const repositorioInformes: RepositorioInformes = {
  async crear(empresaId, solicitanteId, tipo, formato, parametros, expiraAt) {
    const filas = await db
      .insert(informe)
      .values({ empresaId, solicitanteId, tipo, formato, parametros, expiraAt })
      .returning({ id: informe.id })

    const creado = filas[0]
    if (!creado) throw new Error('No se pudo crear el informe')
    return creado.id
  },

  async listar(empresaId, limite = 50): Promise<InformeListado[]> {
    const filas = await db
      .select(columnasListado)
      .from(informe)
      .leftJoin(usuario, eq(usuario.id, informe.solicitanteId))
      .where(eq(informe.empresaId, empresaId))
      .orderBy(desc(informe.createdAt))
      .limit(limite)

    return filas.map(normalizar)
  },

  async obtener(informeId): Promise<InformeListado | null> {
    const filas = await db
      .select(columnasListado)
      .from(informe)
      .leftJoin(usuario, eq(usuario.id, informe.solicitanteId))
      .where(eq(informe.id, informeId))
      .limit(1)

    return filas[0] ? normalizar(filas[0]) : null
  },

  async marcarEnProceso(informeId) {
    const filas = await db
      .update(informe)
      .set({ estado: 'EN_PROCESO', error: null })
      .where(and(eq(informe.id, informeId), eq(informe.estado, 'PENDIENTE')))
      .returning({ id: informe.id })

    return filas.length > 0
  },

  async completar(informeId, nombreArchivo, contenido) {
    await db
      .update(informe)
      .set({
        estado: 'COMPLETADO',
        nombreArchivo,
        contenido,
        tamanoBytes: contenido.length,
        error: null,
        completadoAt: new Date(),
      })
      .where(eq(informe.id, informeId))
  },

  async fallar(informeId, error) {
    await db
      .update(informe)
      .set({
        estado: 'FALLIDO',
        error: error.slice(0, 2_000),
        contenido: null,
        tamanoBytes: null,
        completadoAt: new Date(),
      })
      .where(eq(informe.id, informeId))
  },

  async reintentar(informeId, expiraAt) {
    const filas = await db
      .update(informe)
      .set({
        estado: 'PENDIENTE',
        error: null,
        contenido: null,
        nombreArchivo: null,
        tamanoBytes: null,
        completadoAt: null,
        expiraAt,
      })
      .where(and(eq(informe.id, informeId), eq(informe.estado, 'FALLIDO')))
      .returning({ id: informe.id })

    return filas.length > 0
  },

  async contenido(informeId): Promise<InformeDescargable | null> {
    const filas = await db
      .select({
        id: informe.id,
        empresaId: informe.empresaId,
        nombreArchivo: informe.nombreArchivo,
        contenido: informe.contenido,
        expiraAt: informe.expiraAt,
      })
      .from(informe)
      .where(and(eq(informe.id, informeId), eq(informe.estado, 'COMPLETADO')))
      .limit(1)

    const fila = filas[0]
    if (!fila?.contenido || !fila.nombreArchivo) return null

    return {
      id: fila.id,
      empresaId: fila.empresaId,
      nombreArchivo: fila.nombreArchivo,
      contenido: Buffer.from(fila.contenido),
      expiraAt: fila.expiraAt,
    }
  },

  async limpiarCaducados(ahora) {
    const filas = await db
      .delete(informe)
      .where(and(eq(informe.estado, 'COMPLETADO'), lt(informe.expiraAt, ahora)))
      .returning({ id: informe.id })

    return filas.length
  },
}

export type { FormatoInforme, ParametrosInforme, TipoInforme }
