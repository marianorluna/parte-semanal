import { and, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { empleado, empresa, proyecto, usuario, usuarioProyecto } from '@/db/schema'
import type { Rol } from '@/db/schema'
import { AppError } from '@/shared/errors'

export async function buscarUsuario(usuarioId: string) {
  const filas = await db
    .select({ ...getTableColumns(usuario), empresaCodigo: empresa.codigo })
    .from(usuario)
    .innerJoin(empresa, eq(empresa.id, usuario.empresaId))
    .where(eq(usuario.id, usuarioId))
    .limit(1)

  return filas[0] ?? null
}

export async function empleadoPerteneceAEmpresa(empleadoId: string, empresaId: string): Promise<boolean> {
  const filas = await db
    .select({ id: empleado.id })
    .from(empleado)
    .where(and(eq(empleado.id, empleadoId), eq(empleado.empresaId, empresaId)))
    .limit(1)

  return filas.length > 0
}

export async function emailEnUso(email: string, exceptoId?: string): Promise<boolean> {
  const filas = await db.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, email))
  return filas.some((fila) => fila.id !== exceptoId)
}

export async function crearEmpleado(empresaId: string, codigo: string | null, nombre: string): Promise<string> {
  const codigoFinal = codigo?.trim() || (await siguienteCodigoEmpleado(empresaId))

  const filas = await db
    .insert(empleado)
    .values({ empresaId, codigo: codigoFinal, nombre, activo: true })
    .onConflictDoNothing({ target: empleado.codigo })
    .returning({ id: empleado.id })

  const creado = filas[0]
  if (!creado) {
    throw new AppError('VALIDACION', `Ya existe un empleado con el código ${codigoFinal}`, {
      empleadoCodigo: 'Código duplicado',
    })
  }

  return creado.id
}

async function siguienteCodigoEmpleado(empresaId: string): Promise<string> {
  const filas = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(empleado)
    .where(eq(empleado.empresaId, empresaId))

  const siguiente = (filas[0]?.total ?? 0) + 1
  return `EMP-${String(siguiente).padStart(4, '0')}`
}

export type NuevoUsuario = {
  empresaId: string
  email: string
  nombre: string
  rol: Rol
  passwordHash: string
  empleadoId: string | null
}

export async function crearUsuario(datos: NuevoUsuario): Promise<string> {
  const filas = await db
    .insert(usuario)
    .values({
      empresaId: datos.empresaId,
      email: datos.email,
      nombre: datos.nombre,
      rol: datos.rol,
      passwordHash: datos.passwordHash,
      empleadoId: datos.empleadoId,
      activo: true,
    })
    .returning({ id: usuario.id })

  const creado = filas[0]
  if (!creado) throw new AppError('ERROR_INTERNO', 'No se pudo crear el usuario')
  return creado.id
}

export async function actualizarUsuario(
  usuarioId: string,
  datos: { nombre: string; rol: Rol; activo: boolean; empleadoId: string | null },
): Promise<void> {
  await db.update(usuario).set(datos).where(eq(usuario.id, usuarioId))
}

export async function actualizarPassword(usuarioId: string, passwordHash: string): Promise<void> {
  await db.update(usuario).set({ passwordHash }).where(eq(usuario.id, usuarioId))
}

export async function reemplazarProyectos(
  usuarioId: string,
  proyectoIds: string[],
  empresaId: string,
): Promise<void> {
  const validos =
    proyectoIds.length === 0
      ? []
      : await db
          .select({ id: proyecto.id })
          .from(proyecto)
          .where(and(eq(proyecto.empresaId, empresaId), inArray(proyecto.id, proyectoIds)))

  await db.transaction(async (tx) => {
    await tx.delete(usuarioProyecto).where(eq(usuarioProyecto.usuarioId, usuarioId))
    if (validos.length > 0) {
      await tx.insert(usuarioProyecto).values(validos.map((fila) => ({ usuarioId, proyectoId: fila.id })))
    }
  })
}

export async function proyectosDeUsuario(usuarioId: string): Promise<string[]> {
  const filas = await db
    .select({ proyectoId: usuarioProyecto.proyectoId })
    .from(usuarioProyecto)
    .where(eq(usuarioProyecto.usuarioId, usuarioId))

  return filas.map((fila) => fila.proyectoId)
}
