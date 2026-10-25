import { consumirVentana, type EstadoLimite } from '../domain/limite'
import type { LimitadorConsumo } from '../application/ports'

/**
 * Limitador por proceso. Con un único contenedor (ADR-016) es suficiente para
 * evitar que un clic repetido dispare el coste. No sustituye a un WAF.
 */

export type ConfiguracionLimite = {
  porUsuarioPorMinuto: number
  porUsuarioPorSegundo: number
}

const MAX_CLAVES = 1_000

export function crearLimitadorMemoria(config: ConfiguracionLimite): LimitadorConsumo {
  const estados = new Map<string, EstadoLimite>()

  function podar(ahora: Date): void {
    if (estados.size <= MAX_CLAVES) return
    const minuto = Math.floor(ahora.getTime() / 60_000)
    for (const [clave, estado] of estados) {
      if (estado.minuto < minuto) estados.delete(clave)
    }
  }

  return {
    consumir(clave: string, ahora: Date): boolean {
      const resultado = consumirVentana(
        estados.get(clave),
        ahora,
        config.porUsuarioPorMinuto,
        config.porUsuarioPorSegundo,
      )

      if (resultado.permitido) {
        estados.set(clave, resultado.siguiente)
        podar(ahora)
      }

      return resultado.permitido
    },
  }
}
