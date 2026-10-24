import { cache } from 'react'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db/client'
import { usuario, type Rol } from '@/db/schema'
import { AppError } from '@/shared/errors'

export type UsuarioSesion = {
  id: string
  email: string
  nombre: string
  rol: Rol
  empleadoId: string | null
  empresaId: string
}

/**
 * La sesión JWT puede sobrevivir al borrado o la desactivación del usuario, así que
 * el perfil se relee de la base de datos. `cache` evita repetir la consulta dentro
 * de la misma petición (layout y página comparten resultado).
 */
export const usuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const sesion = await auth()
  if (!sesion?.user?.id) return null

  const filas = await db
    .select({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      empleadoId: usuario.empleadoId,
      empresaId: usuario.empresaId,
    })
    .from(usuario)
    .where(and(eq(usuario.id, sesion.user.id), eq(usuario.activo, true)))
    .limit(1)

  const fila = filas[0]
  if (!fila) return null

  return {
    id: fila.id,
    email: fila.email,
    nombre: fila.nombre,
    rol: fila.rol,
    empleadoId: fila.empleadoId,
    empresaId: fila.empresaId,
  }
})

/** Para páginas: sin sesión, al login. */
export async function requireUsuario(): Promise<UsuarioSesion> {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/login')
  return usuario
}

/** Para páginas: rol insuficiente, a la pantalla de acceso denegado. */
export async function requireRol(...roles: Rol[]): Promise<UsuarioSesion> {
  const usuario = await requireUsuario()
  if (!roles.includes(usuario.rol)) redirect('/sin-acceso')
  return usuario
}

/** Para Server Actions: lanza un error de dominio que se mapea a la respuesta. */
export async function autorizar(...roles: Rol[]): Promise<UsuarioSesion> {
  const usuario = await usuarioActual()
  if (!usuario) throw new AppError('NO_AUTENTICADO', 'Debes iniciar sesión')
  if (!roles.includes(usuario.rol)) throw new AppError('SIN_PERMISO', 'No tienes permiso para esta acción')
  return usuario
}

export function esAdmin(usuario: UsuarioSesion): boolean {
  return usuario.rol === 'ADMIN'
}

export function esEncargado(usuario: UsuarioSesion): boolean {
  return usuario.rol === 'ENCARGADO'
}

export function esTrabajador(usuario: UsuarioSesion): boolean {
  return usuario.rol === 'TRABAJADOR'
}

export function requiereEmpleado(usuario: UsuarioSesion): string {
  if (!usuario.empleadoId) {
    throw new AppError(
      'SIN_PERMISO',
      'Tu usuario no está vinculado a un empleado. Pide a administración que lo configure.',
    )
  }
  return usuario.empleadoId
}

export function rutaInicial(usuario: UsuarioSesion): string {
  if (usuario.rol === 'ADMIN') return '/control/dashboard'
  if (usuario.rol === 'ENCARGADO') return '/control/equipo'
  return '/mi-semana'
}
