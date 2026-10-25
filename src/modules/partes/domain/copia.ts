import type { FechaIso, SemanaIso } from './fechas'
import { trasladarFechaASemana } from './fechas'
import { MINUTOS_POR_DIA } from './horas'
import type { ImputacionEntrada } from './parte'

/**
 * Copia de la semana anterior. Es una proyección, no una lectura de base de
 * datos: recibe las imputaciones ya cargadas y decide qué se puede trasladar a
 * la semana visible. Así el repositorio no cambia y la regla se prueba sin
 * infraestructura.
 */
export type ImputacionOrigen = {
  fecha: FechaIso
  tareaId: string
  minutos: number
}

export type OpcionesProyeccion = {
  semanaOrigen: Pick<SemanaIso, 'weekStart'>
  semanaDestino: Pick<SemanaIso, 'weekStart'>
  /** Tareas asignadas al empleado en la semana destino. */
  tareasPermitidas: ReadonlySet<string>
  /** Días que no admiten horas nuevas (festivo, fin de semana, ausencia). */
  diasNoLaborables: ReadonlySet<FechaIso>
  /** Minutos ya imputados por día en la semana destino. */
  minutosOcupados: ReadonlyMap<FechaIso, number>
}

export type ProyeccionSemana = {
  filas: ImputacionEntrada[]
  totalMinutos: number
  /** Líneas descartadas por tarea no asignada, día no laborable o exceso. */
  omitidas: number
}

/**
 * Reglas de la copia: la misma tarea, el mismo día de la semana, nunca por
 * encima de 24 horas diarias y sin escribir en días no laborables. No
 * sobrescribe: el llamador solo aplica las filas cuya celda está vacía.
 */
export function proyectarSemanaAnterior(
  imputaciones: readonly ImputacionOrigen[],
  opciones: OpcionesProyeccion,
): ProyeccionSemana {
  const ocupados = new Map(opciones.minutosOcupados)
  const filas: ImputacionEntrada[] = []
  let omitidas = 0

  for (const imputacion of imputaciones) {
    if (imputacion.minutos <= 0) continue

    if (!opciones.tareasPermitidas.has(imputacion.tareaId)) {
      omitidas += 1
      continue
    }

    const fecha = trasladarFechaASemana(
      imputacion.fecha,
      opciones.semanaOrigen,
      opciones.semanaDestino,
    )

    if (opciones.diasNoLaborables.has(fecha)) {
      omitidas += 1
      continue
    }

    const yaOcupado = ocupados.get(fecha) ?? 0
    if (yaOcupado + imputacion.minutos > MINUTOS_POR_DIA) {
      omitidas += 1
      continue
    }

    ocupados.set(fecha, yaOcupado + imputacion.minutos)
    filas.push({ fecha, tareaId: imputacion.tareaId, minutos: imputacion.minutos })
  }

  return {
    filas,
    totalMinutos: filas.reduce((suma, fila) => suma + fila.minutos, 0),
    omitidas,
  }
}
