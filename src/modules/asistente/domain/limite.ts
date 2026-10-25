/**
 * Ventana de consumo del asistente. Es una guarda de coste, no una defensa de
 * seguridad: con un único contenedor (ADR-016) basta con memoria del proceso.
 */

export type EstadoLimite = {
  minuto: number
  porMinuto: number
  segundo: number
  porSegundo: number
}

export const LIMITE_POR_MINUTO = 20
export const LIMITE_POR_SEGUNDO = 1

export function ventanaMinuto(fecha: Date): number {
  return Math.floor(fecha.getTime() / 60_000)
}

export function ventanaSegundo(fecha: Date): number {
  return Math.floor(fecha.getTime() / 1_000)
}

/**
 * Decide si la petición cabe en la ventana y devuelve el estado siguiente.
 * Los contadores se reinician al cambiar de minuto o de segundo.
 */
export function consumirVentana(
  estado: EstadoLimite | undefined,
  ahora: Date,
  limitePorMinuto = LIMITE_POR_MINUTO,
  limitePorSegundo = LIMITE_POR_SEGUNDO,
): { permitido: boolean; siguiente: EstadoLimite } {
  const minuto = ventanaMinuto(ahora)
  const segundo = ventanaSegundo(ahora)

  const porMinuto = estado && estado.minuto === minuto ? estado.porMinuto : 0
  const porSegundo = estado && estado.segundo === segundo ? estado.porSegundo : 0

  if (porMinuto >= limitePorMinuto || porSegundo >= limitePorSegundo) {
    return { permitido: false, siguiente: { minuto, porMinuto, segundo, porSegundo } }
  }

  return {
    permitido: true,
    siguiente: {
      minuto,
      porMinuto: porMinuto + 1,
      segundo,
      porSegundo: porSegundo + 1,
    },
  }
}
