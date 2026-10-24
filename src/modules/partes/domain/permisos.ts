import type { Rol } from '@/db/schema'

/**
 * Política de revisión de partes (ADR-005 y decisión de sesión):
 * - El ADMIN revisa cualquier parte, incluida la suya y la de otros administradores.
 * - El ENCARGADO solo revisa partes de usuarios TRABAJADOR de sus proyectos.
 *   Sus propias horas y las de otro encargado o administrador las revisa el ADMIN.
 * - El TRABAJADOR no revisa nada.
 *
 * `rolEmpleado` es el rol del usuario vinculado al empleado del parte; `null`
 * si ese empleado no tiene cuenta (dato legado o incompleto).
 */
export function puedeRevisarParte(actor: Rol, rolEmpleado: Rol | null): boolean {
  if (actor === 'ADMIN') return true
  if (actor !== 'ENCARGADO') return false
  return rolEmpleado === 'TRABAJADOR'
}

/** El encargado solo ve en su bandeja los partes que puede revisar. */
export function bandejaSoloTrabajadores(actor: Rol): boolean {
  return actor === 'ENCARGADO'
}
