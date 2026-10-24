import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import { asignacion, empleado, empresa, imputacion, parte, proyecto, tarea, usuario, usuarioProyecto } from '@/db/schema'
import type {
  ConsultasAvisos,
  EncargadoDeProyecto,
  EncargadoPendiente,
  ProyectoConsumo,
  UsuarioAviso,
  UsuarioPendiente,
} from '../application/ports'

const trabajadorUsuario = alias(usuario, 'trabajador_usuario')

/** Estados que cuentan como cumplidos: el trabajador ya hizo su parte. */
const ESTADOS_ENVIADOS = sql`${parte.estado} in ('ENVIADO', 'APROBADO', 'BLOQUEADO')`

const PENDIENTE_DE_ACCION = sql`${parte.estado} is null or ${parte.estado} in ('BORRADOR', 'RECHAZADO')`

export const consultasAvisos: ConsultasAvisos = {
  async listarEmpresasActivas(): Promise<{ id: string }[]> {
    return db.select({ id: empresa.id }).from(empresa).where(eq(empresa.activa, true))
  },

  async usuariosConPartePendiente(empresaId, semana): Promise<UsuarioPendiente[]> {
    const filas = await db
      .select({
        usuarioId: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        empleadoId: empleado.id,
        estadoParte: parte.estado,
      })
      .from(usuario)
      .innerJoin(empleado, eq(empleado.id, usuario.empleadoId))
      .leftJoin(
        parte,
        and(
          eq(parte.empleadoId, empleado.id),
          eq(parte.isoYear, semana.isoYear),
          eq(parte.isoWeek, semana.isoWeek),
        ),
      )
      .where(and(eq(usuario.empresaId, empresaId), eq(usuario.activo, true), eq(empleado.activo, true)))

    return filas.filter(
      (fila) => fila.estadoParte === null || fila.estadoParte === 'BORRADOR' || fila.estadoParte === 'RECHAZADO',
    )
  },

  async equipoPendientePorEncargado(empresaId, semana): Promise<EncargadoPendiente[]> {
    const filas = await db
      .select({
        usuarioId: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        pendientes: sql<number>`count(distinct ${trabajadorUsuario.id}) filter (where ${PENDIENTE_DE_ACCION})`.mapWith(
          Number,
        ),
        nombresPendientes: sql<string[]>`coalesce(array_agg(distinct ${trabajadorUsuario.nombre}) filter (where ${PENDIENTE_DE_ACCION}), '{}')`,
      })
      .from(usuario)
      .innerJoin(usuarioProyecto, eq(usuarioProyecto.usuarioId, usuario.id))
      .innerJoin(tarea, eq(tarea.proyectoId, usuarioProyecto.proyectoId))
      .innerJoin(
        asignacion,
        and(
          eq(asignacion.tareaId, tarea.id),
          eq(asignacion.activa, true),
          lte(asignacion.desde, semana.weekEnd),
          or(isNull(asignacion.hasta), gte(asignacion.hasta, semana.weekStart)),
        ),
      )
      .innerJoin(
        trabajadorUsuario,
        and(
          eq(trabajadorUsuario.empleadoId, asignacion.empleadoId),
          eq(trabajadorUsuario.rol, 'TRABAJADOR'),
          eq(trabajadorUsuario.activo, true),
        ),
      )
      .leftJoin(
        parte,
        and(
          eq(parte.empleadoId, asignacion.empleadoId),
          eq(parte.isoYear, semana.isoYear),
          eq(parte.isoWeek, semana.isoWeek),
        ),
      )
      .where(and(eq(usuario.empresaId, empresaId), eq(usuario.rol, 'ENCARGADO'), eq(usuario.activo, true)))
      .groupBy(usuario.id, usuario.email, usuario.nombre)

    return filas.filter((fila) => fila.pendientes > 0)
  },

  async consumoPorProyecto(empresaId): Promise<ProyectoConsumo[]> {
    return db
      .select({
        proyectoId: proyecto.id,
        codigo: proyecto.codigo,
        nombre: proyecto.nombre,
        horasPresupuesto: proyecto.horasPresupuesto,
        fechaInicio: proyecto.fechaInicio,
        fechaFin: proyecto.fechaFin,
        minutos: sql<number>`coalesce(sum(${imputacion.minutos}) filter (where ${ESTADOS_ENVIADOS}), 0)`.mapWith(
          Number,
        ),
      })
      .from(proyecto)
      .leftJoin(tarea, eq(tarea.proyectoId, proyecto.id))
      .leftJoin(imputacion, eq(imputacion.tareaId, tarea.id))
      .leftJoin(parte, eq(parte.id, imputacion.parteId))
      .where(and(eq(proyecto.empresaId, empresaId), eq(proyecto.activo, true)))
      .groupBy(
        proyecto.id,
        proyecto.codigo,
        proyecto.nombre,
        proyecto.horasPresupuesto,
        proyecto.fechaInicio,
        proyecto.fechaFin,
      )
      .orderBy(proyecto.codigo)
  },

  async encargadosDeProyectos(proyectoIds): Promise<EncargadoDeProyecto[]> {
    if (proyectoIds.length === 0) return []

    return db
      .select({
        proyectoId: usuarioProyecto.proyectoId,
        usuarioId: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
      })
      .from(usuarioProyecto)
      .innerJoin(usuario, eq(usuario.id, usuarioProyecto.usuarioId))
      .where(
        and(
          inArray(usuarioProyecto.proyectoId, proyectoIds),
          eq(usuario.rol, 'ENCARGADO'),
          eq(usuario.activo, true),
        ),
      )
  },

  async adminsDeEmpresa(empresaId): Promise<UsuarioAviso[]> {
    return db
      .select({ usuarioId: usuario.id, email: usuario.email, nombre: usuario.nombre })
      .from(usuario)
      .where(and(eq(usuario.empresaId, empresaId), eq(usuario.rol, 'ADMIN'), eq(usuario.activo, true)))
  },
}
