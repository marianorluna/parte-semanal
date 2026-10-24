import { and, eq, ilike, or } from 'drizzle-orm'
import { db } from '@/db/client'
import { empleado, empresa, imputacion, proyecto, tarea, usuario, usuarioProyecto } from '@/db/schema'
import type { Rol } from '@/db/schema'
import type { UsuarioSesion } from '../application/sesion'

export type ProyectoOpcion = {
  id: string
  codigo: string
  nombre: string
}

export type EmpleadoOpcion = {
  id: string
  codigo: string
  nombre: string
  activo: boolean
}

export type UsuarioListado = {
  id: string
  email: string
  nombre: string
  rol: Rol
  activo: boolean
  empleadoId: string | null
  empleadoNombre: string | null
  empleadoCodigo: string | null
  /** Permite distinguir las cuentas del seed (empresa DEMO) sin mirar el correo. */
  empresaCodigo: string
}

export async function proyectosAsignadosAUsuario(usuarioId: string): Promise<string[]> {
  const filas = await db
    .select({ proyectoId: usuarioProyecto.proyectoId })
    .from(usuarioProyecto)
    .where(eq(usuarioProyecto.usuarioId, usuarioId))

  return filas.map((fila) => fila.proyectoId)
}

/** null significa "todos los proyectos de la empresa" (ADMIN). */
export async function proyectosPermitidos(usuario: UsuarioSesion): Promise<string[] | null> {
  if (usuario.rol === 'ADMIN') return null
  if (usuario.rol === 'ENCARGADO') return proyectosAsignadosAUsuario(usuario.id)
  return []
}

export async function listarProyectos(empresaId: string): Promise<ProyectoOpcion[]> {
  return db
    .select({ id: proyecto.id, codigo: proyecto.codigo, nombre: proyecto.nombre })
    .from(proyecto)
    .where(and(eq(proyecto.empresaId, empresaId), eq(proyecto.activo, true)))
    .orderBy(proyecto.codigo)
}

export async function proyectosDeParte(parteId: string): Promise<string[]> {
  const filas = await db
    .selectDistinct({ proyectoId: tarea.proyectoId })
    .from(imputacion)
    .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
    .where(eq(imputacion.parteId, parteId))

  return filas.map((fila) => fila.proyectoId)
}

/** Rol del usuario vinculado a un empleado; `null` si no tiene cuenta. */
export async function rolDeEmpleado(empleadoId: string): Promise<Rol | null> {
  const filas = await db
    .select({ rol: usuario.rol })
    .from(usuario)
    .where(eq(usuario.empleadoId, empleadoId))
    .limit(1)

  return filas[0]?.rol ?? null
}

export async function listarEmpleadosDeEmpresa(empresaId: string): Promise<EmpleadoOpcion[]> {
  return db
    .select({ id: empleado.id, codigo: empleado.codigo, nombre: empleado.nombre, activo: empleado.activo })
    .from(empleado)
    .where(eq(empleado.empresaId, empresaId))
    .orderBy(empleado.codigo)
}

export async function listarUsuarios(empresaId: string, filtro?: string): Promise<UsuarioListado[]> {
  const condiciones = [eq(usuario.empresaId, empresaId)]
  if (filtro && filtro.trim().length > 0) {
    const patron = `%${filtro.trim()}%`
    const busqueda = or(ilike(usuario.email, patron), ilike(usuario.nombre, patron))
    if (busqueda) condiciones.push(busqueda)
  }

  return db
    .select({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      activo: usuario.activo,
      empleadoId: usuario.empleadoId,
      empleadoNombre: empleado.nombre,
      empleadoCodigo: empleado.codigo,
      empresaCodigo: empresa.codigo,
    })
    .from(usuario)
    .leftJoin(empleado, eq(empleado.id, usuario.empleadoId))
    .innerJoin(empresa, eq(empresa.id, usuario.empresaId))
    .where(and(...condiciones))
    .orderBy(usuario.rol, usuario.nombre)
}
