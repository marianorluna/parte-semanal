'use server'

import { AuthError } from 'next-auth'
import { z } from 'zod'
import { signIn, signOut } from '@/auth'
import { env } from '@/config/env'
import { buscarCuentaDemo } from '@/modules/identidad/application/cuentas-demo'

const esquema = z.object({
  email: z.string().trim().toLowerCase().email('Introduce un email válido'),
  password: z.string().min(1, 'Introduce tu contraseña'),
})

export type EstadoLogin = { error?: string }

const MAX_INTENTOS = 8
const VENTANA_MS = 15 * 60 * 1000
const intentos = new Map<string, { total: number; hasta: number }>()

function superaElLimite(clave: string): boolean {
  const ahora = Date.now()
  const registro = intentos.get(clave)
  if (!registro || registro.hasta < ahora) return false
  return registro.total >= MAX_INTENTOS
}

/** Solo cuentan los intentos fallidos: un acceso correcto limpia el contador. */
function registrarFallo(clave: string): void {
  const ahora = Date.now()
  const registro = intentos.get(clave)
  if (!registro || registro.hasta < ahora) {
    intentos.set(clave, { total: 1, hasta: ahora + VENTANA_MS })
    return
  }
  registro.total += 1
}

async function entrar(email: string, password: string): Promise<EstadoLogin> {
  if (superaElLimite(email)) {
    return { error: 'Demasiados intentos. Espera unos minutos antes de volver a probar.' }
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/',
    })
    intentos.delete(email)
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      registrarFallo(email)
      return { error: 'Email o contraseña incorrectos' }
    }
    throw error
  }
}

export async function iniciarSesion(_estado: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const parsed = esquema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
  }

  return entrar(parsed.data.email, parsed.data.password)
}

/**
 * Acceso de prueba: resuelve email y contraseña en el servidor, de modo que la
 * contraseña común del demo nunca viaja al navegador. Solo se aceptan las
 * cuentas conocidas y únicamente con ACCESO_RAPIDO_DEMO activo.
 */
export async function iniciarSesionRapida(_estado: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  if (!env().ACCESO_RAPIDO_DEMO) {
    return { error: 'El acceso rápido está desactivado' }
  }

  const clave = formData.get('cuenta')
  const cuenta = typeof clave === 'string' ? buscarCuentaDemo(clave) : null
  if (!cuenta) {
    return { error: 'Cuenta de prueba no válida' }
  }

  return entrar(cuenta.email, env().DEMO_PASSWORD)
}

export async function cerrarSesion(): Promise<void> {
  await signOut({ redirectTo: '/login' })
}
