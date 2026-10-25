export const CLAVES_ACCESO_RAPIDO = ['ADMIN', 'ENCARGADO', 'TRABAJADOR'] as const

export type ClaveAccesoRapido = (typeof CLAVES_ACCESO_RAPIDO)[number]

export type CuentaAccesoRapido = {
  clave: ClaveAccesoRapido
  etiqueta: string
  nombre: string
  email: string
}

/**
 * Cuentas del seed demo que el login ofrece como acceso rápido mientras la app
 * está en pruebas. Los correos son genéricos a propósito (cualquiera puede
 * usarlos sin asociarlos a una persona real); los nombres son de fantasía para
 * que la demo no parezca un entorno con datos de plantilla.
 *
 * El seed crea estos mismos correos para las tres cuentas destacadas, así login
 * y datos no se desincronizan: el nombre es la clave que ambos comparten.
 */
const CUENTAS: Record<ClaveAccesoRapido, Omit<CuentaAccesoRapido, 'clave'>> = {
  ADMIN: {
    etiqueta: 'Administrador',
    nombre: 'Leo Messi',
    email: 'administrador@levitec.es',
  },
  ENCARGADO: {
    etiqueta: 'Encargado',
    nombre: 'Daniel Rabinovich',
    email: 'encargado@levitec.es',
  },
  TRABAJADOR: {
    etiqueta: 'Trabajador',
    nombre: 'Juan Maldacena',
    email: 'trabajador01@levitec.es',
  },
}

export const CUENTAS_ACCESO_RAPIDO: readonly CuentaAccesoRapido[] = CLAVES_ACCESO_RAPIDO.map((clave) => ({
  clave,
  ...CUENTAS[clave],
}))

export function buscarCuentaDemo(clave: string): CuentaAccesoRapido | null {
  return CUENTAS_ACCESO_RAPIDO.find((cuenta) => cuenta.clave === clave) ?? null
}
