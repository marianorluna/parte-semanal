'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { hashPassword } from '@/modules/identidad/application/password'
import {
  actualizarPassword,
  actualizarUsuario,
  buscarUsuario,
  crearEmpleado,
  crearUsuario,
  emailEnUso,
  empleadoPerteneceAEmpresa,
  reemplazarProyectos,
} from '@/modules/identidad/infrastructure/comandos-usuarios'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { AppError } from '@/shared/errors'

export type EstadoAdmin = {
  error?: string
  ok?: string
  campo?: Record<string, string>
}

const rolSchema = z.enum(['TRABAJADOR', 'ENCARGADO', 'ADMIN'])

const crearSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email no válido'),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
  rol: rolSchema,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
  empleadoId: z.string().uuid().optional().or(z.literal('')),
  empleadoCodigo: z.string().trim().max(40).optional(),
  empleadoNombre: z.string().trim().max(120).optional(),
  proyectos: z.array(z.string().uuid()).default([]),
})

function aError(error: unknown): EstadoAdmin {
  if (error instanceof AppError) {
    return { error: error.message, campo: error.detalles }
  }
  console.error('[admin/usuarios]', error)
  return { error: 'No se pudo completar la operación' }
}

export async function crearUsuarioAction(_prev: EstadoAdmin, formData: FormData): Promise<EstadoAdmin> {
  try {
    const actor = await autorizar('ADMIN')

    const parsed = crearSchema.safeParse({
      email: formData.get('email') ?? '',
      nombre: formData.get('nombre') ?? '',
      rol: formData.get('rol') ?? 'TRABAJADOR',
      password: formData.get('password') ?? '',
      empleadoId: formData.get('empleadoId') ?? '',
      empleadoCodigo: formData.get('empleadoCodigo') ?? '',
      empleadoNombre: formData.get('empleadoNombre') ?? '',
      proyectos: formData.getAll('proyectos'),
    })

    if (!parsed.success) {
      const campo: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const clave = issue.path.join('.')
        if (clave) campo[clave] = issue.message
      }
      return { error: 'Revisa los campos marcados', campo }
    }

    const datos = parsed.data

    if (await emailEnUso(datos.email)) {
      return { error: 'Ya existe un usuario con ese email', campo: { email: 'Email duplicado' } }
    }

    let empleadoId = datos.empleadoId || null
    if (empleadoId && !(await empleadoPerteneceAEmpresa(empleadoId, actor.empresaId))) {
      return { error: 'El empleado seleccionado no existe', campo: { empleadoId: 'Empleado no válido' } }
    }
    if (!empleadoId && datos.empleadoNombre && datos.empleadoNombre.trim().length > 1) {
      empleadoId = await crearEmpleado(
        actor.empresaId,
        datos.empleadoCodigo ?? null,
        datos.empleadoNombre.trim(),
      )
    }

    if (datos.rol !== 'ADMIN' && !empleadoId) {
      return {
        error: 'Los trabajadores y encargados necesitan un empleado asociado',
        campo: { empleadoNombre: 'Indica el nombre del empleado' },
      }
    }

    const passwordHash = await hashPassword(datos.password)
    const usuarioId = await crearUsuario({
      empresaId: actor.empresaId,
      email: datos.email,
      nombre: datos.nombre,
      rol: datos.rol,
      passwordHash,
      empleadoId,
    })

    if (datos.proyectos.length > 0) {
      await reemplazarProyectos(usuarioId, datos.proyectos, actor.empresaId)
    }

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'usuario',
      entidadId: usuarioId,
      accion: 'CREAR_USUARIO',
      despues: { email: datos.email, rol: datos.rol },
    })

    revalidatePath('/admin/usuarios')
    return { ok: `Usuario ${datos.email} creado` }
  } catch (error) {
    return aError(error)
  }
}

const editarSchema = z.object({
  usuarioId: z.string().uuid(),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
  rol: rolSchema,
  activo: z.coerce.boolean().default(false),
  proyectos: z.array(z.string().uuid()).default([]),
})

export async function actualizarUsuarioAction(_prev: EstadoAdmin, formData: FormData): Promise<EstadoAdmin> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = editarSchema.safeParse({
      usuarioId: formData.get('usuarioId'),
      nombre: formData.get('nombre') ?? '',
      rol: formData.get('rol') ?? '',
      activo: formData.get('activo') === 'on',
      proyectos: formData.getAll('proyectos'),
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
    }

    const datos = parsed.data

    const fila = await buscarUsuario(datos.usuarioId)
    if (!fila || fila.empresaId !== actor.empresaId) {
      throw new AppError('NO_ENCONTRADO', 'El usuario no existe')
    }

    await actualizarUsuario(datos.usuarioId, {
      nombre: datos.nombre,
      rol: datos.rol,
      activo: datos.activo,
      empleadoId: fila.empleadoId,
    })

    await reemplazarProyectos(datos.usuarioId, datos.proyectos, actor.empresaId)

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'usuario',
      entidadId: datos.usuarioId,
      accion: 'ACTUALIZAR_USUARIO',
      despues: { nombre: datos.nombre, rol: datos.rol, activo: datos.activo },
    })

    revalidatePath('/admin/usuarios')
    revalidatePath(`/admin/usuarios/${datos.usuarioId}`)
    return { ok: 'Cambios guardados' }
  } catch (error) {
    return aError(error)
  }
}

const passwordSchema = z.object({
  usuarioId: z.string().uuid(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
})

export async function resetPasswordAction(_prev: EstadoAdmin, formData: FormData): Promise<EstadoAdmin> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = passwordSchema.safeParse({
      usuarioId: formData.get('usuarioId'),
      password: formData.get('password') ?? '',
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
    }

    const fila = await buscarUsuario(parsed.data.usuarioId)
    if (!fila || fila.empresaId !== actor.empresaId) {
      throw new AppError('NO_ENCONTRADO', 'El usuario no existe')
    }

    const passwordHash = await hashPassword(parsed.data.password)
    await actualizarPassword(parsed.data.usuarioId, passwordHash)

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'usuario',
      entidadId: parsed.data.usuarioId,
      accion: 'RESET_PASSWORD',
    })

    revalidatePath(`/admin/usuarios/${parsed.data.usuarioId}`)
    return { ok: 'Contraseña actualizada' }
  } catch (error) {
    return aError(error)
  }
}
