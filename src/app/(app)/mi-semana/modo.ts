/**
 * Preferencia de vista de Mi Semana. Vive en una cookie, no en el estado de
 * sesión: es una elección de interfaz por dispositivo y no debe tocar la base
 * de datos ni el dominio del parte.
 */
export type ModoMiSemana = 'rapido' | 'detalle'

export const COOKIE_MODO = 'modo-mi-semana'

export const MODO_POR_DEFECTO: ModoMiSemana = 'rapido'

/** Un año, para que la elección sobreviva entre visitas. */
export const MAX_EDAD_COOKIE = 60 * 60 * 24 * 365

export function esModo(valor: unknown): valor is ModoMiSemana {
  return valor === 'rapido' || valor === 'detalle'
}

/** Valor de `document.cookie` al cambiar de modo en el cliente. */
export function cookieModo(modo: ModoMiSemana): string {
  return `${COOKIE_MODO}=${modo}; path=/; max-age=${MAX_EDAD_COOKIE}; samesite=lax`
}
