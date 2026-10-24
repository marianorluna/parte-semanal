/**
 * Motor de cómputo puro: convierte minutos imputados en minutos equivalentes
 * según las reglas versionadas de un convenio.
 *
 * Sin I/O, sin reloj y sin decimales: los factores se guardan en puntos básicos
 * enteros (10 000 = 1,0) y los minutos computados se redondean al minuto.
 *
 * La hora nocturna no se calcula: no hay hora de inicio y fin (ADR-014).
 */

export const TIPOS_HORA = [
  'NORMAL',
  'EXTRA',
  'COMPLEMENTARIA',
  'FESTIVA',
  'VIAJE',
  'FORMACION',
  'PARALIZACION',
] as const

export type TipoHora = (typeof TIPOS_HORA)[number]

export const APLICACIONES = ['TODO', 'LABORABLE', 'FESTIVO'] as const

export type AplicaEn = (typeof APLICACIONES)[number]

export const FACTOR_UNIDAD_BPS = 10_000

export type ReglaComputo = {
  id: string
  tipoHora: TipoHora
  factorBps: number
  aplicaEn: AplicaEn
  topeDiarioMin: number | null
  topeSemanalMin: number | null
  requiereAutorizacion: boolean
  prioridad: number
  activo: boolean
}

export type LineaEntrada = {
  imputacionId: string
  fecha: string
  minutos: number
  /** Día festivo (no fin de semana): habilita las reglas de contexto FESTIVO. */
  esFestivo: boolean
}

export type TramoCalculado = {
  imputacionId: string
  tramo: number
  tipoHora: TipoHora
  minutosBase: number
  factorBps: number
  minutosComputados: number
  requiereAutorizacion: boolean
  reglaId: string | null
}

export type ResumenComputo = {
  minutosBase: number
  minutosComputados: number
  /** Minutos base agrupados por el tipo de hora que les aplicó. */
  porTipo: Partial<Record<TipoHora, number>>
  requiereAutorizacion: boolean
}

export const ETIQUETAS_TIPO_HORA: Record<TipoHora, string> = {
  NORMAL: 'Normal',
  EXTRA: 'Extra',
  COMPLEMENTARIA: 'Complementaria',
  FESTIVA: 'Festiva',
  VIAJE: 'Viaje',
  FORMACION: 'Formación',
  PARALIZACION: 'Paralización',
}

export function esTipoHora(valor: string): valor is TipoHora {
  return (TIPOS_HORA as readonly string[]).includes(valor)
}

export function minutosConFactor(minutosBase: number, factorBps: number): number {
  return Math.round((minutosBase * factorBps) / FACTOR_UNIDAD_BPS)
}

/** Formatea el factor en puntos básicos como texto legible: 15000 -> `1,5`. */
export function formatearFactor(factorBps: number): string {
  return (factorBps / FACTOR_UNIDAD_BPS).toFixed(2).replace('.', ',').replace(/,?0+$/, '')
}

/**
 * Elige la regla aplicable. El contexto específico (festivo o laborable) gana
 * siempre al comodín `TODO`; dentro de cada contexto decide la prioridad menor.
 */
export function reglaAplicable(
  reglas: readonly ReglaComputo[],
  esFestivo: boolean,
): ReglaComputo | null {
  const activas = reglas.filter((regla) => regla.activo)
  const contexto: AplicaEn = esFestivo ? 'FESTIVO' : 'LABORABLE'

  const especificas = activas
    .filter((regla) => regla.aplicaEn === contexto)
    .sort((a, b) => a.prioridad - b.prioridad || a.tipoHora.localeCompare(b.tipoHora))

  if (especificas.length > 0) return especificas[0] ?? null

  const comodines = activas
    .filter((regla) => regla.aplicaEn === 'TODO')
    .sort((a, b) => a.prioridad - b.prioridad || a.tipoHora.localeCompare(b.tipoHora))

  return comodines[0] ?? null
}

/**
 * Calcula los tramos de una semana. Un tramo es la parte de una imputación que
 * cae dentro de un tope; lo que lo supera se computa a factor 1 y queda como
 * `NORMAL`, sin consumir el tope de la regla.
 */
export function computarSemana(
  lineas: readonly LineaEntrada[],
  reglas: readonly ReglaComputo[],
): TramoCalculado[] {
  const acumulado = new Map<string, number>()
  let semana = 0
  const resultado: TramoCalculado[] = []

  const ordenadas = [...lineas]
    .filter((linea) => Number.isFinite(linea.minutos) && linea.minutos > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.imputacionId.localeCompare(b.imputacionId))

  for (const linea of ordenadas) {
    const regla = reglaAplicable(reglas, linea.esFestivo)
    const tipoHora: TipoHora = regla?.tipoHora ?? 'NORMAL'
    const factorBps = regla?.factorBps ?? FACTOR_UNIDAD_BPS
    const requiereAutorizacion = regla?.requiereAutorizacion ?? false
    const reglaId = regla?.id ?? null

    const usadoDia = acumulado.get(linea.fecha) ?? 0
    const limiteDia = regla?.topeDiarioMin ?? Number.POSITIVE_INFINITY
    const limiteSemana = regla?.topeSemanalMin ?? Number.POSITIVE_INFINITY
    const disponible = Math.max(0, Math.min(limiteDia - usadoDia, limiteSemana - semana))
    const conFactor = Math.min(linea.minutos, disponible)
    const sinFactor = linea.minutos - conFactor

    let tramo = 0

    if (conFactor > 0) {
      resultado.push({
        imputacionId: linea.imputacionId,
        tramo,
        tipoHora,
        minutosBase: conFactor,
        factorBps,
        minutosComputados: minutosConFactor(conFactor, factorBps),
        requiereAutorizacion,
        reglaId,
      })
      acumulado.set(linea.fecha, usadoDia + conFactor)
      semana += conFactor
      tramo += 1
    }

    if (sinFactor > 0) {
      resultado.push({
        imputacionId: linea.imputacionId,
        tramo,
        tipoHora: 'NORMAL',
        minutosBase: sinFactor,
        factorBps: FACTOR_UNIDAD_BPS,
        minutosComputados: sinFactor,
        requiereAutorizacion: false,
        reglaId: null,
      })
    }
  }

  return resultado
}

export function resumir(tramos: readonly TramoCalculado[]): ResumenComputo {
  const porTipo: Partial<Record<TipoHora, number>> = {}
  let minutosBase = 0
  let minutosComputados = 0
  let requiereAutorizacion = false

  for (const tramo of tramos) {
    minutosBase += tramo.minutosBase
    minutosComputados += tramo.minutosComputados
    porTipo[tramo.tipoHora] = (porTipo[tramo.tipoHora] ?? 0) + tramo.minutosBase
    requiereAutorizacion = requiereAutorizacion || tramo.requiereAutorizacion
  }

  return { minutosBase, minutosComputados, porTipo, requiereAutorizacion }
}

export type ErrorRegla = { campo: string; mensaje: string }

/** Validación de una regla antes de guardarla. Devuelve el primer error. */
export function validarRegla(regla: {
  factorBps: number
  topeDiarioMin: number | null
  topeSemanalMin: number | null
  prioridad: number
}): ErrorRegla | null {
  if (!Number.isInteger(regla.factorBps) || regla.factorBps < 0 || regla.factorBps > 100_000) {
    return { campo: 'factor', mensaje: 'El factor debe estar entre 0 y 10' }
  }
  if (
    regla.topeDiarioMin !== null &&
    (!Number.isInteger(regla.topeDiarioMin) || regla.topeDiarioMin <= 0 || regla.topeDiarioMin > 1440)
  ) {
    return { campo: 'topeDiario', mensaje: 'El tope diario debe estar entre 1 minuto y 24 horas' }
  }
  if (
    regla.topeSemanalMin !== null &&
    (!Number.isInteger(regla.topeSemanalMin) || regla.topeSemanalMin <= 0 || regla.topeSemanalMin > 10_080)
  ) {
    return { campo: 'topeSemanal', mensaje: 'El tope semanal debe estar entre 1 minuto y 168 horas' }
  }
  if (!Number.isInteger(regla.prioridad) || regla.prioridad < 0 || regla.prioridad > 10_000) {
    return { campo: 'prioridad', mensaje: 'La prioridad no es válida' }
  }
  return null
}
