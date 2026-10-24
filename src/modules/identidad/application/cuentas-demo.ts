import { emailCorporativo } from '../domain/email-corporativo'

export const CLAVES_ACCESO_RAPIDO = ['ADMIN', 'ENCARGADO', 'TRABAJADOR'] as const

export type ClaveAccesoRapido = (typeof CLAVES_ACCESO_RAPIDO)[number]

export type CuentaAccesoRapido = {
  clave: ClaveAccesoRapido
  etiqueta: string
  nombre: string
  email: string
}

const CUENTAS: Record<ClaveAccesoRapido, { etiqueta: string; nombre: string }> = {
  ADMIN: { etiqueta: 'Administrador', nombre: 'David Sierra' },
  ENCARGADO: { etiqueta: 'Encargado', nombre: 'Fernando Nieto' },
  TRABAJADOR: { etiqueta: 'Trabajador', nombre: 'Álvaro Méndez' },
}

/**
 * Cuentas del seed demo que el login ofrece como acceso rápido mientras la app
 * está en pruebas. El correo se deriva del nombre con el mismo formato que usa
 * el seed, así que ambos no pueden desincronizarse.
 */
export const CUENTAS_ACCESO_RAPIDO: readonly CuentaAccesoRapido[] = CLAVES_ACCESO_RAPIDO.map((clave) => {
  const cuenta = CUENTAS[clave]
  return {
    clave,
    etiqueta: cuenta.etiqueta,
    nombre: cuenta.nombre,
    email: emailCorporativo(cuenta.nombre),
  }
})

export function buscarCuentaDemo(clave: string): CuentaAccesoRapido | null {
  return CUENTAS_ACCESO_RAPIDO.find((cuenta) => cuenta.clave === clave) ?? null
}
