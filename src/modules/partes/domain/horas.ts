export const MINUTOS_POR_HORA = 60
export const MINUTOS_POR_DIA = 1440

export type ResultadoHoras =
  | { ok: true; minutos: number }
  | { ok: false; error: string }

/**
 * Acepta `1,5`, `1.5`, `1:30`, `90m` y vacío (0). Devuelve minutos enteros.
 * Redondeo al minuto más cercano.
 */
export function horasAMinutos(entrada: string): ResultadoHoras {
  const texto = entrada.trim().replace(/\s+/g, '')
  if (texto === '') return { ok: true, minutos: 0 }

  const conDosPuntos = /^(\d{1,2}):([0-5]\d)$/.exec(texto)
  if (conDosPuntos) {
    const horas = Number(conDosPuntos[1])
    const minutos = Number(conDosPuntos[2])
    return { ok: true, minutos: horas * MINUTOS_POR_HORA + minutos }
  }

  const decimal = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(texto)
  if (!decimal) {
    return { ok: false, error: 'Formato no válido. Usa 7,5 o 7:30' }
  }

  const horas = Number(decimal[1])
  const fraccion = decimal[2] ?? '0'
  const minutosDecimales = Math.round(Number(`0.${fraccion}`) * MINUTOS_POR_HORA)
  return { ok: true, minutos: horas * MINUTOS_POR_HORA + minutosDecimales }
}

export function minutosAHorasDecimal(minutos: number): string {
  const horas = minutos / MINUTOS_POR_HORA
  return horas.toFixed(2).replace('.', ',')
}

/** Formato `7:30`, útil en rejillas e informes. */
export function formatearHorasReloj(minutos: number): string {
  const signo = minutos < 0 ? '-' : ''
  const absoluto = Math.abs(minutos)
  const horas = Math.floor(absoluto / MINUTOS_POR_HORA)
  const resto = absoluto % MINUTOS_POR_HORA
  return `${signo}${horas}:${String(resto).padStart(2, '0')}`
}

/**
 * Texto editable para un campo de horas: `8` cuando son horas exactas y `7:30`
 * cuando hay fracción. Evita que el autoguardado reescriba `8` como `8,00`.
 */
export function aTextoEditable(minutos: number): string {
  if (minutos === 0) return ''
  return minutos % MINUTOS_POR_HORA === 0 ? String(minutos / MINUTOS_POR_HORA) : formatearHorasReloj(minutos)
}

export function sumarMinutos(valores: readonly number[]): number {
  return valores.reduce((total, valor) => total + valor, 0)
}

export function porcentaje(parte: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((parte / total) * 100)
}
