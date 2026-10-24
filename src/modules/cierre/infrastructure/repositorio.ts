import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import type { Db } from '@/db/client'
import {
  auditoria,
  empleado,
  imputacion,
  parte,
  periodoCerrado,
  usuario,
} from '@/db/schema'
import { AppError } from '@/shared/errors'
import { solapaRango, type TipoPeriodo } from '../domain/cierre'
import type {
  DatosPeriodo,
  PeriodoCerradoListado,
  RepositorioCierre,
} from '../application/ports'

const reabridor = alias(usuario, 'reabridor')

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const columnasListado = {
  id: periodoCerrado.id,
  tipo: periodoCerrado.tipo,
  empleadoId: periodoCerrado.empleadoId,
  empleadoNombre: empleado.nombre,
  empleadoCodigo: empleado.codigo,
  isoYear: periodoCerrado.isoYear,
  isoWeek: periodoCerrado.isoWeek,
  anio: periodoCerrado.anio,
  mes: periodoCerrado.mes,
  desde: periodoCerrado.desde,
  hasta: periodoCerrado.hasta,
  motivo: periodoCerrado.motivo,
  partesBloqueados: periodoCerrado.partesBloqueados,
  cerradoPorNombre: usuario.nombre,
  createdAt: periodoCerrado.createdAt,
  reabiertoAt: periodoCerrado.reabiertoAt,
  reabiertoPorNombre: reabridor.nombre,
  motivoReapertura: periodoCerrado.motivoReapertura,
}

type FilaListado = Omit<PeriodoCerradoListado, 'activo'>

function aListado(fila: FilaListado): PeriodoCerradoListado {
  return { ...fila, activo: fila.reabiertoAt === null }
}

function consultaListado() {
  return db
    .select(columnasListado)
    .from(periodoCerrado)
    .leftJoin(empleado, eq(empleado.id, periodoCerrado.empleadoId))
    .leftJoin(usuario, eq(usuario.id, periodoCerrado.cerradoPor))
    .leftJoin(reabridor, eq(reabridor.id, periodoCerrado.reabiertoPor))
}

async function auditarPartes(
  tx: Tx,
  ids: readonly string[],
  actorId: string,
  accion: 'BLOQUEAR_PARTE' | 'DESBLOQUEAR_PARTE',
  periodoId: string,
  motivo: string | null,
): Promise<void> {
  if (ids.length === 0) return
  await tx.insert(auditoria).values(
    ids.map((parteId) => ({
      actorId,
      entidad: 'parte',
      entidadId: parteId,
      accion,
      despues: { estado: accion === 'BLOQUEAR_PARTE' ? 'BLOQUEADO' : 'APROBADO', periodoId },
      motivo,
    })),
  )
}

function ambitoEmpleado(empleadoId: string | null) {
  return empleadoId ? eq(parte.empleadoId, empleadoId) : undefined
}

/** Partes aprobados que toca el cierre: por semana ISO o por fecha imputada. */
async function partesDelPeriodo(
  tx: Tx,
  datos: DatosPeriodo,
  estado: 'APROBADO' | 'BLOQUEADO',
) {
  const condiciones = [
    eq(parte.empresaId, datos.empresaId),
    eq(parte.estado, estado),
    ambitoEmpleado(datos.empleadoId),
  ]

  if (datos.tipo === 'SEMANAL') {
    return tx
      .select({ id: parte.id, empleadoId: parte.empleadoId, isoYear: parte.isoYear, isoWeek: parte.isoWeek })
      .from(parte)
      .where(
        and(
          ...condiciones,
          datos.isoYear === null ? undefined : eq(parte.isoYear, datos.isoYear),
          datos.isoWeek === null ? undefined : eq(parte.isoWeek, datos.isoWeek),
        ),
      )
  }

  return tx
    .selectDistinct({
      id: parte.id,
      empleadoId: parte.empleadoId,
      isoYear: parte.isoYear,
      isoWeek: parte.isoWeek,
    })
    .from(parte)
    .innerJoin(imputacion, eq(imputacion.parteId, parte.id))
    .where(
      and(
        ...condiciones,
        gte(imputacion.fecha, datos.desde),
        lte(imputacion.fecha, datos.hasta),
      ),
    )
}

type ParteAfectado = {
  id: string
  empleadoId: string
  isoYear: number
  isoWeek: number
}

function cubiertoPor(
  periodo: {
    tipo: TipoPeriodo
    empleadoId: string | null
    isoYear: number | null
    isoWeek: number | null
    desde: string
    hasta: string
  },
  afectado: ParteAfectado,
  fechas: readonly string[],
): boolean {
  if (periodo.empleadoId !== null && periodo.empleadoId !== afectado.empleadoId) return false
  if (periodo.tipo === 'SEMANAL') {
    return periodo.isoYear === afectado.isoYear && periodo.isoWeek === afectado.isoWeek
  }
  return fechas.some((fecha) => periodo.desde <= fecha && fecha <= periodo.hasta)
}

export const repositorioCierre: RepositorioCierre = {
  async listar(empresaId) {
    const filas = await consultaListado()
      .where(eq(periodoCerrado.empresaId, empresaId))
      .orderBy(desc(periodoCerrado.desde), desc(periodoCerrado.createdAt))
    return filas.map(aListado)
  },

  async obtener(periodoId, empresaId) {
    const filas = await consultaListado()
      .where(and(eq(periodoCerrado.id, periodoId), eq(periodoCerrado.empresaId, empresaId)))
      .limit(1)
    const fila = filas[0]
    return fila ? aListado(fila) : null
  },

  async solapesActivos(datos) {
    const condiciones = [
      eq(periodoCerrado.empresaId, datos.empresaId),
      eq(periodoCerrado.tipo, datos.tipo),
      isNull(periodoCerrado.reabiertoAt),
      datos.empleadoId
        ? eq(periodoCerrado.empleadoId, datos.empleadoId)
        : isNull(periodoCerrado.empleadoId),
    ]

    const filas = await db
      .select({ desde: periodoCerrado.desde, hasta: periodoCerrado.hasta })
      .from(periodoCerrado)
      .where(and(...condiciones))

    return filas.filter((fila) => solapaRango(fila, datos))
  },

  async cerrar(datos, actorId) {
    return db.transaction(async (tx) => {
      const creados = await tx
        .insert(periodoCerrado)
        .values({
          empresaId: datos.empresaId,
          tipo: datos.tipo,
          empleadoId: datos.empleadoId,
          isoYear: datos.isoYear,
          isoWeek: datos.isoWeek,
          anio: datos.anio,
          mes: datos.mes,
          desde: datos.desde,
          hasta: datos.hasta,
          motivo: datos.motivo,
          cerradoPor: actorId,
        })
        .returning({ id: periodoCerrado.id })

      const creado = creados[0]
      if (!creado) throw new AppError('ERROR_INTERNO', 'No se pudo crear el cierre')

      const afectados = await partesDelPeriodo(tx, datos, 'APROBADO')

      if (afectados.length > 0) {
        await tx
          .update(parte)
          .set({
            estado: 'BLOQUEADO',
            version: sql`${parte.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(
                parte.id,
                afectados.map((afectado) => afectado.id),
              ),
              eq(parte.estado, 'APROBADO'),
            ),
          )

        await auditarPartes(
          tx,
          afectados.map((afectado) => afectado.id),
          actorId,
          'BLOQUEAR_PARTE',
          creado.id,
          datos.motivo,
        )
      }

      await tx
        .update(periodoCerrado)
        .set({ partesBloqueados: afectados.length })
        .where(eq(periodoCerrado.id, creado.id))

      await tx.insert(auditoria).values({
        actorId,
        entidad: 'periodo_cerrado',
        entidadId: creado.id,
        accion: 'CERRAR_PERIODO',
        despues: {
          tipo: datos.tipo,
          desde: datos.desde,
          hasta: datos.hasta,
          empleadoId: datos.empleadoId,
          partesBloqueados: afectados.length,
        },
        motivo: datos.motivo,
      })

      return { id: creado.id, partesBloqueados: afectados.length }
    })
  },

  async reabrir(periodoId, empresaId, actorId, motivo) {
    return db.transaction(async (tx) => {
      const actuales = await tx
        .select()
        .from(periodoCerrado)
        .where(and(eq(periodoCerrado.id, periodoId), eq(periodoCerrado.empresaId, empresaId)))
        .limit(1)

      const actual = actuales[0]
      if (!actual) throw new AppError('NO_ENCONTRADO', 'El periodo no existe')
      if (actual.reabiertoAt !== null) {
        throw new AppError('ESTADO_INVALIDO', 'El periodo ya está reabierto')
      }

      await tx
        .update(periodoCerrado)
        .set({
          reabiertoPor: actorId,
          reabiertoAt: new Date(),
          motivoReapertura: motivo,
        })
        .where(eq(periodoCerrado.id, periodoId))

      const datos: DatosPeriodo = {
        empresaId,
        tipo: actual.tipo,
        empleadoId: actual.empleadoId,
        isoYear: actual.isoYear,
        isoWeek: actual.isoWeek,
        anio: actual.anio,
        mes: actual.mes,
        desde: actual.desde,
        hasta: actual.hasta,
        motivo: actual.motivo,
      }

      const candidatos: ParteAfectado[] = await partesDelPeriodo(tx, datos, 'BLOQUEADO')

      const otros = await tx
        .select({
          tipo: periodoCerrado.tipo,
          empleadoId: periodoCerrado.empleadoId,
          isoYear: periodoCerrado.isoYear,
          isoWeek: periodoCerrado.isoWeek,
          desde: periodoCerrado.desde,
          hasta: periodoCerrado.hasta,
        })
        .from(periodoCerrado)
        .where(
          and(
            eq(periodoCerrado.empresaId, empresaId),
            isNull(periodoCerrado.reabiertoAt),
            sql`${periodoCerrado.id} <> ${periodoId}`,
          ),
        )

      const fechasPorParte = new Map<string, string[]>()
      if (candidatos.length > 0) {
        const fechas = await tx
          .select({ parteId: imputacion.parteId, fecha: imputacion.fecha })
          .from(imputacion)
          .where(
            inArray(
              imputacion.parteId,
              candidatos.map((candidato) => candidato.id),
            ),
          )
        for (const fila of fechas) {
          const lista = fechasPorParte.get(fila.parteId) ?? []
          lista.push(fila.fecha)
          fechasPorParte.set(fila.parteId, lista)
        }
      }

      const desbloqueables = candidatos.filter((candidato) => {
        const fechas = fechasPorParte.get(candidato.id) ?? []
        return !otros.some((periodo) => cubiertoPor(periodo, candidato, fechas))
      })

      if (desbloqueables.length > 0) {
        await tx
          .update(parte)
          .set({
            estado: 'APROBADO',
            version: sql`${parte.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(
                parte.id,
                desbloqueables.map((desbloqueable) => desbloqueable.id),
              ),
              eq(parte.estado, 'BLOQUEADO'),
            ),
          )

        await auditarPartes(
          tx,
          desbloqueables.map((desbloqueable) => desbloqueable.id),
          actorId,
          'DESBLOQUEAR_PARTE',
          periodoId,
          motivo,
        )
      }

      await tx.insert(auditoria).values({
        actorId,
        entidad: 'periodo_cerrado',
        entidadId: periodoId,
        accion: 'REABRIR_PERIODO',
        antes: { reabiertoAt: null, partesBloqueados: actual.partesBloqueados },
        despues: {
          reabiertoAt: new Date().toISOString(),
          partesDesbloqueados: desbloqueables.length,
        },
        motivo,
      })

      return { partesDesbloqueados: desbloqueables.map((desbloqueable) => desbloqueable.id) }
    })
  },

  async periodosActivos(empresaId, empleadoId) {
    return db
      .select({ desde: periodoCerrado.desde, hasta: periodoCerrado.hasta })
      .from(periodoCerrado)
      .where(
        and(
          eq(periodoCerrado.empresaId, empresaId),
          isNull(periodoCerrado.reabiertoAt),
          or(
            isNull(periodoCerrado.empleadoId),
            eq(periodoCerrado.empleadoId, empleadoId),
          ),
        ),
      )
  },

  async empleadoPerteneceAEmpresa(empleadoId, empresaId) {
    const filas = await db
      .select({ id: empleado.id })
      .from(empleado)
      .where(and(eq(empleado.id, empleadoId), eq(empleado.empresaId, empresaId)))
      .limit(1)
    return filas.length > 0
  },
}
