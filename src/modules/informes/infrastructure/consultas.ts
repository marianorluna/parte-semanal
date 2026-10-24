import { and, asc, countDistinct, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  auditoria,
  ausencia,
  costeImputacion,
  empleado,
  imputacion,
  parte,
  proyecto,
  resultadoComputo,
  tarea,
  tipoAusencia,
  usuario,
} from '@/db/schema'
import { formatearEuros } from '@/modules/coste/domain/coste'
import { minutosAHorasDecimal } from '@/modules/partes/domain/horas'
import { exactamente, resumir } from '../application/formato'
import type { ConsultasInformes } from '../application/ports'
import type { TablaInforme } from '../domain/informe'

function euros(cents: number | null): string {
  return cents === null ? '-' : formatearEuros(cents)
}

function factor(bps: number): string {
  return `×${(bps / 10_000).toFixed(2).replace('.', ',')}`
}

export const consultasInformes: ConsultasInformes = {
  async certificacionMensual(empresaId, anio, mes): Promise<TablaInforme> {
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

    const filas = await db
      .select({
        empleado: empleado.nombre,
        codigo: empleado.codigo,
        proyecto: proyecto.nombre,
        proyectoCodigo: proyecto.codigo,
        dias: countDistinct(imputacion.fecha),
        minutos: sql<number>`coalesce(sum(${imputacion.minutos}), 0)`.mapWith(Number),
      })
      .from(imputacion)
      .innerJoin(parte, eq(parte.id, imputacion.parteId))
      .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
      .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
      .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
      .where(
        and(
          eq(parte.empresaId, empresaId),
          inArray(parte.estado, ['APROBADO', 'BLOQUEADO']),
          gte(imputacion.fecha, desde),
          lte(imputacion.fecha, hasta),
        ),
      )
      .groupBy(empleado.id, empleado.nombre, empleado.codigo, proyecto.id, proyecto.nombre, proyecto.codigo)
      .orderBy(asc(empleado.nombre), asc(proyecto.codigo))

    const totalMinutos = filas.reduce((total, fila) => total + fila.minutos, 0)

    return {
      titulo: 'Certificación mensual de horas',
      subtitulo: `Periodo ${desde} a ${hasta} · solo partes aprobados`,
      columnas: [
        { clave: 'empleado', etiqueta: 'Empleado', tipo: 'texto', ancho: 30 },
        { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', ancho: 14 },
        { clave: 'proyecto', etiqueta: 'Proyecto', tipo: 'texto', ancho: 34 },
        { clave: 'proyectoCodigo', etiqueta: 'Cód. proyecto', tipo: 'texto', ancho: 14 },
        { clave: 'dias', etiqueta: 'Días', tipo: 'numero', ancho: 8 },
        { clave: 'horas', etiqueta: 'Horas', tipo: 'numero', ancho: 10 },
        { clave: 'minutos', etiqueta: 'Minutos', tipo: 'numero', ancho: 10 },
      ],
      filas: filas.map((fila) => ({
        empleado: fila.empleado,
        codigo: fila.codigo,
        proyecto: fila.proyecto,
        proyectoCodigo: fila.proyectoCodigo,
        dias: fila.dias,
        horas: Number(minutosAHorasDecimal(fila.minutos).replace(',', '.')),
        minutos: fila.minutos,
      })),
      resumen: [
        { etiqueta: 'Empleados', valor: String(new Set(filas.map((fila) => fila.codigo)).size) },
        exactamente('Horas totales', `${minutosAHorasDecimal(totalMinutos)} h`),
      ],
    }
  },

  async libroJornada(empresaId, desde, hasta): Promise<TablaInforme> {
    const filas = await db
      .select({
        fecha: imputacion.fecha,
        empleado: empleado.nombre,
        codigo: empleado.codigo,
        proyectos: countDistinct(proyecto.id),
        minutos: sql<number>`coalesce(sum(${imputacion.minutos}), 0)`.mapWith(Number),
        estado: sql<string>`${parte.estado}::text`,
      })
      .from(imputacion)
      .innerJoin(parte, eq(parte.id, imputacion.parteId))
      .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
      .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
      .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
      .where(
        and(
          eq(parte.empresaId, empresaId),
          inArray(parte.estado, ['APROBADO', 'BLOQUEADO']),
          gte(imputacion.fecha, desde),
          lte(imputacion.fecha, hasta),
        ),
      )
      .groupBy(imputacion.fecha, empleado.id, empleado.nombre, empleado.codigo, parte.estado)
      .orderBy(asc(imputacion.fecha), asc(empleado.nombre))

    const totalMinutos = filas.reduce((total, fila) => total + fila.minutos, 0)

    return {
      titulo: 'Libro de jornada',
      subtitulo: `Periodo ${desde} a ${hasta} · partes aprobados`,
      columnas: [
        { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', ancho: 12 },
        { clave: 'empleado', etiqueta: 'Empleado', tipo: 'texto', ancho: 30 },
        { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', ancho: 14 },
        { clave: 'proyectos', etiqueta: 'Proyectos', tipo: 'numero', ancho: 10 },
        { clave: 'horas', etiqueta: 'Horas', tipo: 'numero', ancho: 10 },
        { clave: 'minutos', etiqueta: 'Minutos', tipo: 'numero', ancho: 10 },
        { clave: 'estado', etiqueta: 'Estado parte', tipo: 'texto', ancho: 14 },
      ],
      filas: filas.map((fila) => ({
        fecha: fila.fecha,
        empleado: fila.empleado,
        codigo: fila.codigo,
        proyectos: fila.proyectos,
        horas: Number(minutosAHorasDecimal(fila.minutos).replace(',', '.')),
        minutos: fila.minutos,
        estado: fila.estado,
      })),
      resumen: resumir('Horas totales', totalMinutos),
    }
  },

  async costesProyecto(empresaId, desde, hasta, proyectoId): Promise<TablaInforme> {
    const condiciones = [
      eq(proyecto.empresaId, empresaId),
      gte(costeImputacion.fecha, desde),
      lte(costeImputacion.fecha, hasta),
    ]
    if (proyectoId) condiciones.push(eq(costeImputacion.proyectoId, proyectoId))

    const filas = await db
      .select({
        fecha: costeImputacion.fecha,
        empleado: empleado.nombre,
        codigo: empleado.codigo,
        proyecto: proyecto.nombre,
        proyectoCodigo: proyecto.codigo,
        tarea: tarea.nombre,
        minutos: costeImputacion.minutos,
        costeHoraCents: costeImputacion.costeHoraCents,
        importeCents: costeImputacion.importeCents,
        sinTarifa: costeImputacion.sinTarifa,
      })
      .from(costeImputacion)
      .innerJoin(empleado, eq(empleado.id, costeImputacion.empleadoId))
      .innerJoin(proyecto, eq(proyecto.id, costeImputacion.proyectoId))
      .innerJoin(tarea, eq(tarea.id, costeImputacion.tareaId))
      .where(and(...condiciones))
      .orderBy(asc(costeImputacion.fecha), asc(empleado.codigo), asc(proyecto.codigo))

    const totalCents = filas.reduce((total, fila) => total + fila.importeCents, 0)
    const sinTarifa = filas.filter((fila) => fila.sinTarifa).length

    return {
      titulo: 'Costes reales por proyecto',
      subtitulo: `Periodo ${desde} a ${hasta} · snapshot de coste al aprobar`,
      columnas: [
        { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', ancho: 12 },
        { clave: 'empleado', etiqueta: 'Empleado', tipo: 'texto', ancho: 28 },
        { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', ancho: 12 },
        { clave: 'proyecto', etiqueta: 'Proyecto', tipo: 'texto', ancho: 30 },
        { clave: 'proyectoCodigo', etiqueta: 'Cód. proyecto', tipo: 'texto', ancho: 14 },
        { clave: 'tarea', etiqueta: 'Tarea', tipo: 'texto', ancho: 26 },
        { clave: 'horas', etiqueta: 'Horas', tipo: 'numero', ancho: 10 },
        { clave: 'costeHora', etiqueta: 'Coste/hora', tipo: 'texto', ancho: 12 },
        { clave: 'importe', etiqueta: 'Importe', tipo: 'texto', ancho: 14 },
      ],
      filas: filas.map((fila) => ({
        fecha: fila.fecha,
        empleado: fila.empleado,
        codigo: fila.codigo,
        proyecto: fila.proyecto,
        proyectoCodigo: fila.proyectoCodigo,
        tarea: fila.tarea,
        horas: Number(minutosAHorasDecimal(fila.minutos).replace(',', '.')),
        costeHora: euros(fila.costeHoraCents),
        importe: euros(fila.importeCents),
      })),
      resumen: [
        exactamente('Coste total', euros(totalCents)),
        ...(sinTarifa > 0 ? [{ etiqueta: 'Líneas sin tarifa', valor: String(sinTarifa) }] : []),
      ],
    }
  },

  async ausencias(empresaId, desde, hasta): Promise<TablaInforme> {
    const filas = await db
      .select({
        empleado: empleado.nombre,
        codigo: empleado.codigo,
        tipo: tipoAusencia.nombre,
        inicio: ausencia.desde,
        fin: ausencia.hasta,
        minutos: ausencia.minutos,
        estado: sql<string>`${ausencia.estado}::text`,
        motivo: ausencia.motivoSolicitud,
      })
      .from(ausencia)
      .innerJoin(empleado, eq(empleado.id, ausencia.empleadoId))
      .innerJoin(tipoAusencia, eq(tipoAusencia.id, ausencia.tipoId))
      .where(
        and(
          eq(ausencia.empresaId, empresaId),
          lte(ausencia.desde, hasta),
          gte(ausencia.hasta, desde),
        ),
      )
      .orderBy(asc(ausencia.desde), asc(empleado.nombre))

    return {
      titulo: 'Ausencias y vacaciones',
      subtitulo: `Periodo ${desde} a ${hasta}`,
      columnas: [
        { clave: 'empleado', etiqueta: 'Empleado', tipo: 'texto', ancho: 28 },
        { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', ancho: 12 },
        { clave: 'tipo', etiqueta: 'Tipo', tipo: 'texto', ancho: 18 },
        { clave: 'inicio', etiqueta: 'Desde', tipo: 'fecha', ancho: 12 },
        { clave: 'fin', etiqueta: 'Hasta', tipo: 'fecha', ancho: 12 },
        { clave: 'minutos', etiqueta: 'Minutos', tipo: 'numero', ancho: 10 },
        { clave: 'estado', etiqueta: 'Estado', tipo: 'texto', ancho: 14 },
        { clave: 'motivo', etiqueta: 'Motivo', tipo: 'texto', ancho: 30 },
      ],
      filas: filas.map((fila) => ({
        empleado: fila.empleado,
        codigo: fila.codigo,
        tipo: fila.tipo,
        inicio: fila.inicio,
        fin: fila.fin,
        minutos: fila.minutos ?? '',
        estado: fila.estado,
        motivo: fila.motivo ?? '',
      })),
      resumen: [
        { etiqueta: 'Registros', valor: String(filas.length) },
        {
          etiqueta: 'Aprobadas',
          valor: String(filas.filter((fila) => fila.estado === 'APROBADA').length),
        },
      ],
    }
  },

  async horasExtra(empresaId, desde, hasta): Promise<TablaInforme> {
    const filas = await db
      .select({
        fecha: imputacion.fecha,
        empleado: empleado.nombre,
        codigo: empleado.codigo,
        proyecto: proyecto.nombre,
        tarea: tarea.nombre,
        minutosBase: resultadoComputo.minutosBase,
        minutosComputados: resultadoComputo.minutosComputados,
        factorBps: resultadoComputo.factorBps,
        autorizacion: resultadoComputo.requiereAutorizacion,
      })
      .from(resultadoComputo)
      .innerJoin(imputacion, eq(imputacion.id, resultadoComputo.imputacionId))
      .innerJoin(parte, eq(parte.id, resultadoComputo.parteId))
      .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
      .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
      .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
      .where(
        and(
          eq(parte.empresaId, empresaId),
          eq(resultadoComputo.tipoHora, 'EXTRA'),
          gte(imputacion.fecha, desde),
          lte(imputacion.fecha, hasta),
        ),
      )
      .orderBy(asc(imputacion.fecha), asc(empleado.nombre))

    const totalBase = filas.reduce((total, fila) => total + fila.minutosBase, 0)
    const totalComputado = filas.reduce((total, fila) => total + fila.minutosComputados, 0)

    return {
      titulo: 'Horas extra',
      subtitulo: `Periodo ${desde} a ${hasta} · reglas de cómputo aplicadas`,
      columnas: [
        { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', ancho: 12 },
        { clave: 'empleado', etiqueta: 'Empleado', tipo: 'texto', ancho: 28 },
        { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', ancho: 12 },
        { clave: 'proyecto', etiqueta: 'Proyecto', tipo: 'texto', ancho: 30 },
        { clave: 'tarea', etiqueta: 'Tarea', tipo: 'texto', ancho: 26 },
        { clave: 'minutosBase', etiqueta: 'Min. base', tipo: 'numero', ancho: 10 },
        { clave: 'factor', etiqueta: 'Factor', tipo: 'texto', ancho: 10 },
        { clave: 'minutosComputados', etiqueta: 'Min. computados', tipo: 'numero', ancho: 14 },
        { clave: 'autorizacion', etiqueta: 'Autorización', tipo: 'texto', ancho: 14 },
      ],
      filas: filas.map((fila) => ({
        fecha: fila.fecha,
        empleado: fila.empleado,
        codigo: fila.codigo,
        proyecto: fila.proyecto,
        tarea: fila.tarea,
        minutosBase: fila.minutosBase,
        factor: factor(fila.factorBps),
        minutosComputados: fila.minutosComputados,
        autorizacion: fila.autorizacion ? 'Requerida' : 'No',
      })),
      resumen: [
        exactamente('Minutos base', `${totalBase} min`),
        exactamente('Minutos computados', `${totalComputado} min`),
      ],
    }
  },

  async auditoria(empresaId, desde, hasta): Promise<TablaInforme> {
    const filas = await db
      .select({
        createdAt: auditoria.createdAt,
        actor: usuario.nombre,
        accion: auditoria.accion,
        entidad: auditoria.entidad,
        entidadId: auditoria.entidadId,
        motivo: auditoria.motivo,
      })
      .from(auditoria)
      .innerJoin(usuario, eq(usuario.id, auditoria.actorId))
      .where(
        and(
          eq(usuario.empresaId, empresaId),
          gte(auditoria.createdAt, new Date(`${desde}T00:00:00.000Z`)),
          lte(auditoria.createdAt, new Date(`${hasta}T23:59:59.999Z`)),
        ),
      )
      .orderBy(desc(auditoria.createdAt))

    return {
      titulo: 'Auditoría',
      subtitulo: `Periodo ${desde} a ${hasta}`,
      columnas: [
        { clave: 'fecha', etiqueta: 'Fecha y hora', tipo: 'texto', ancho: 20 },
        { clave: 'actor', etiqueta: 'Actor', tipo: 'texto', ancho: 24 },
        { clave: 'accion', etiqueta: 'Acción', tipo: 'texto', ancho: 28 },
        { clave: 'entidad', etiqueta: 'Entidad', tipo: 'texto', ancho: 18 },
        { clave: 'entidadId', etiqueta: 'ID entidad', tipo: 'texto', ancho: 38 },
        { clave: 'motivo', etiqueta: 'Motivo', tipo: 'texto', ancho: 36 },
      ],
      filas: filas.map((fila) => ({
        fecha: fila.createdAt.toISOString().slice(0, 19).replace('T', ' '),
        actor: fila.actor,
        accion: fila.accion,
        entidad: fila.entidad,
        entidadId: fila.entidadId ?? '',
        motivo: fila.motivo ?? '',
      })),
      resumen: [{ etiqueta: 'Eventos', valor: String(filas.length) }],
    }
  },
}
