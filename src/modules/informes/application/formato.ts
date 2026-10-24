import { minutosAHorasDecimal } from '@/modules/partes/domain/horas'
import type { ResumenInforme } from '../domain/informe'

/** Devuelve el resumen tal cual para encajar en `TablaInforme.resumen`. */
export function resumir(etiqueta: string, minutos: number): ResumenInforme[] {
  return [{ etiqueta, valor: `${minutosAHorasDecimal(minutos)} h` }]
}

export function exactamente(etiqueta: string, valor: string): ResumenInforme {
  return { etiqueta, valor }
}
