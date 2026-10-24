import { MINUTOS_POR_HORA, porcentaje } from '@/modules/partes/domain/horas'
import { type FechaIso, aFecha, diasEntre } from '@/modules/partes/domain/fechas'

/**
 * Riesgo de desviación de un proyecto: compara el consumo de horas con el
 * presupuesto y con el plazo transcurrido. Función pura, sin base de datos.
 * Ver ADR-011.
 */
export type NivelRiesgo =
  | 'AGOTADO'
  | 'CRITICO'
  | 'AVISO'
  | 'OK'
  | 'SIN_PRESUPUESTO'
  | 'SIN_PLAZO'

export type EntradaRiesgo = {
  minutosConsumidos: number
  horasPresupuesto: number | null
  fechaInicio: FechaIso | null
  fechaFin: FechaIso | null
  hoy: FechaIso
}

export type RiesgoProyecto = {
  nivel: NivelRiesgo
  /** Porcentaje del presupuesto consumido. `null` si no hay presupuesto. */
  consumoPct: number | null
  /** Porcentaje del plazo transcurrido. `null` si no hay plazo. */
  plazoPct: number | null
  /** Consumo menos plazo, en puntos porcentuales. */
  desviacionPp: number | null
  /** Consumo proyectado al cierre manteniendo el ritmo actual. */
  proyeccionPct: number | null
  minutosPresupuesto: number | null
  minutosRestantes: number | null
  diasTotales: number | null
  diasTranscurridos: number | null
  etiqueta: string
  detalle: string
}

export const ETIQUETAS_RIESGO: Record<NivelRiesgo, string> = {
  AGOTADO: 'Presupuesto agotado',
  CRITICO: 'Riesgo alto',
  AVISO: 'Vigilar',
  OK: 'En ritmo',
  SIN_PRESUPUESTO: 'Sin presupuesto',
  SIN_PLAZO: 'Sin plazo',
}

export const CLASES_RIESGO: Record<NivelRiesgo, string> = {
  AGOTADO: 'bg-red-100 text-red-800',
  CRITICO: 'bg-orange-100 text-orange-800',
  AVISO: 'bg-amber-100 text-amber-800',
  OK: 'bg-acento-100 text-acento-800',
  SIN_PRESUPUESTO: 'bg-slate-100 text-slate-600',
  SIN_PLAZO: 'bg-slate-100 text-slate-600',
}

export function esNivelAlerta(nivel: NivelRiesgo): boolean {
  return nivel === 'AGOTADO' || nivel === 'CRITICO' || nivel === 'AVISO'
}

export function evaluarRiesgo(entrada: EntradaRiesgo): RiesgoProyecto {
  const minutosConsumidos = Math.max(0, Math.trunc(entrada.minutosConsumidos))
  const horasPresupuesto = entrada.horasPresupuesto
  const hayPresupuesto = horasPresupuesto !== null && horasPresupuesto > 0
  const minutosPresupuesto = hayPresupuesto ? horasPresupuesto * MINUTOS_POR_HORA : null

  const consumoPct = minutosPresupuesto ? porcentaje(minutosConsumidos, minutosPresupuesto) : null
  const minutosRestantes = minutosPresupuesto === null ? null : minutosPresupuesto - minutosConsumidos

  const plazo = calcularPlazo(entrada)
  const plazoPct = plazo ? plazo.porcentaje : null
  const desviacionPp = consumoPct !== null && plazoPct !== null ? consumoPct - plazoPct : null
  const proyeccionPct = proyectar(consumoPct, plazoPct)

  const base = {
    consumoPct,
    plazoPct,
    desviacionPp,
    proyeccionPct,
    minutosPresupuesto,
    minutosRestantes,
    diasTotales: plazo?.diasTotales ?? null,
    diasTranscurridos: plazo?.diasTranscurridos ?? null,
  }

  if (consumoPct === null) {
    return {
      ...base,
      nivel: 'SIN_PRESUPUESTO',
      etiqueta: ETIQUETAS_RIESGO.SIN_PRESUPUESTO,
      detalle: 'Define horas de presupuesto para medir la desviación.',
    }
  }

  if (plazoPct === null) {
    return {
      ...base,
      nivel: 'SIN_PLAZO',
      etiqueta: ETIQUETAS_RIESGO.SIN_PLAZO,
      detalle: 'Define fechas de inicio y fin para medir la desviación temporal.',
    }
  }

  const nivel = clasificar(consumoPct, desviacionPp ?? 0, proyeccionPct ?? 0)
  return {
    ...base,
    nivel,
    etiqueta: ETIQUETAS_RIESGO[nivel],
    detalle: describir(nivel, consumoPct, plazoPct, proyeccionPct ?? 0),
  }
}

function clasificar(consumoPct: number, desviacionPp: number, proyeccionPct: number): NivelRiesgo {
  if (consumoPct >= 100) return 'AGOTADO'
  if (proyeccionPct >= 125 || desviacionPp >= 20 || consumoPct >= 90) return 'CRITICO'
  if (proyeccionPct >= 110 || desviacionPp >= 10) return 'AVISO'
  return 'OK'
}

function describir(nivel: NivelRiesgo, consumoPct: number, plazoPct: number, proyeccionPct: number): string {
  if (nivel === 'AGOTADO') return `Consumo ${consumoPct}% del presupuesto. No quedan horas.`
  if (nivel === 'CRITICO') {
    return `Consumo ${consumoPct}% con ${plazoPct}% del plazo. Proyección al cierre: ${proyeccionPct}%.`
  }
  if (nivel === 'AVISO') return `Consumo ${consumoPct}% con ${plazoPct}% del plazo. Conviene revisarlo.`
  return `Consumo ${consumoPct}% con ${plazoPct}% del plazo.`
}

function proyectar(consumoPct: number | null, plazoPct: number | null): number | null {
  if (consumoPct === null || plazoPct === null) return null
  if (plazoPct <= 0) return consumoPct > 0 ? 999 : 0
  return Math.round((consumoPct / plazoPct) * 100)
}

function calcularPlazo(entrada: EntradaRiesgo): {
  diasTotales: number
  diasTranscurridos: number
  porcentaje: number
} | null {
  if (!entrada.fechaInicio || !entrada.fechaFin) return null

  const diasTotales = diasEntre(entrada.fechaInicio, entrada.fechaFin) + 1
  if (diasTotales <= 0) return null

  const transcurridos = diasEntre(entrada.fechaInicio, entrada.hoy) + 1
  const diasTranscurridos = Math.min(Math.max(transcurridos, 0), diasTotales)

  return {
    diasTotales,
    diasTranscurridos,
    porcentaje: porcentaje(diasTranscurridos, diasTotales),
  }
}

export type ResumenRiesgo = {
  total: number
  agotados: number
  criticos: number
  avisos: number
  ok: number
  sinDatos: number
}

export function resumirRiesgos(riesgos: readonly RiesgoProyecto[]): ResumenRiesgo {
  const resumen: ResumenRiesgo = {
    total: riesgos.length,
    agotados: 0,
    criticos: 0,
    avisos: 0,
    ok: 0,
    sinDatos: 0,
  }

  for (const riesgo of riesgos) {
    if (riesgo.nivel === 'AGOTADO') resumen.agotados += 1
    else if (riesgo.nivel === 'CRITICO') resumen.criticos += 1
    else if (riesgo.nivel === 'AVISO') resumen.avisos += 1
    else if (riesgo.nivel === 'OK') resumen.ok += 1
    else resumen.sinDatos += 1
  }

  return resumen
}

/**
 * Minutos diarios admisibles para terminar en plazo con el presupuesto dado.
 * Responde a "¿cuánto puedo gastar por día de aquí al cierre?".
 */
export function ritmoAdmisible(riesgo: RiesgoProyecto): number | null {
  if (riesgo.minutosRestantes === null || riesgo.diasTotales === null || riesgo.diasTranscurridos === null) {
    return null
  }
  const diasRestantes = Math.max(riesgo.diasTotales - riesgo.diasTranscurridos, 1)
  return Math.max(0, Math.round(riesgo.minutosRestantes / diasRestantes))
}

/** Fechas válidas y en orden. Devuelve `false` si el plazo es incoherente. */
export function plazoValido(fechaInicio: FechaIso | null, fechaFin: FechaIso | null): boolean {
  if (!fechaInicio && !fechaFin) return true
  if (!fechaInicio || !fechaFin) return false
  return aFecha(fechaInicio).getTime() <= aFecha(fechaFin).getTime()
}
