import type { EstadoParte } from '@/db/schema'

/**
 * Cumplimiento semanal del equipo: qué ha hecho cada persona con su parte.
 * Se calcula sobre un `left join` de empleado y parte, así que `estado` es
 * `null` cuando no existe parte para esa semana.
 */
export type EstadoCumplimiento = EstadoParte | 'SIN_PARTE'

export const ESTADOS_CUMPLIMIENTO: readonly EstadoCumplimiento[] = [
  'SIN_PARTE',
  'BORRADOR',
  'ENVIADO',
  'APROBADO',
  'RECHAZADO',
  'BLOQUEADO',
]

export type EntradaCumplimiento = {
  estado: EstadoParte | 'SIN_PARTE' | null
  totalMinutos?: number
}

export const ETIQUETAS_CUMPLIMIENTO: Record<EstadoCumplimiento, string> = {
  SIN_PARTE: 'Sin parte',
  BORRADOR: 'Borrador',
  ENVIADO: 'Pendiente de revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  BLOQUEADO: 'Bloqueado',
}

export const CLASES_CUMPLIMIENTO: Record<EstadoCumplimiento, string> = {
  SIN_PARTE: 'bg-slate-200 text-slate-700',
  BORRADOR: 'bg-slate-100 text-slate-700',
  ENVIADO: 'bg-amber-100 text-amber-800',
  APROBADO: 'bg-acento-100 text-acento-800',
  RECHAZADO: 'bg-red-100 text-red-800',
  BLOQUEADO: 'bg-marca-900 text-white',
}

export function estadoCumplimiento(entrada: EntradaCumplimiento): EstadoCumplimiento {
  return entrada.estado ?? 'SIN_PARTE'
}

/** Pendiente de que el trabajador actúe: sin parte, en borrador o rechazado. */
export function requiereAccionDelTrabajador(estado: EstadoCumplimiento): boolean {
  return estado === 'SIN_PARTE' || estado === 'BORRADOR' || estado === 'RECHAZADO'
}

/** Ya enviado y esperando al encargado. */
export function pendienteDeRevision(estado: EstadoCumplimiento): boolean {
  return estado === 'ENVIADO'
}

/**
 * Orden de atención para el encargado: primero lo que bloquea el cierre.
 * Menor número, más urgente.
 */
export function prioridadCumplimiento(estado: EstadoCumplimiento): number {
  switch (estado) {
    case 'SIN_PARTE':
      return 0
    case 'BORRADOR':
      return 1
    case 'RECHAZADO':
      return 2
    case 'ENVIADO':
      return 3
    case 'APROBADO':
    default:
      return 4
  }
}

export type ResumenCumplimiento = {
  total: number
  aprobados: number
  enviados: number
  borradores: number
  rechazados: number
  sinParte: number
  /** Personas que todavía tienen que cargar o corregir horas. */
  pendientesDelTrabajador: number
  /** Porcentaje de partes enviados o aprobados sobre el total. */
  cumplimientoPct: number
}

export function resumirCumplimiento(
  entradas: readonly EntradaCumplimiento[],
): ResumenCumplimiento {
  const resumen: ResumenCumplimiento = {
    total: entradas.length,
    aprobados: 0,
    enviados: 0,
    borradores: 0,
    rechazados: 0,
    sinParte: 0,
    pendientesDelTrabajador: 0,
    cumplimientoPct: 0,
  }

  for (const entrada of entradas) {
    const estado = estadoCumplimiento(entrada)
    if (estado === 'APROBADO' || estado === 'BLOQUEADO') resumen.aprobados += 1
    else if (estado === 'ENVIADO') resumen.enviados += 1
    else if (estado === 'BORRADOR') resumen.borradores += 1
    else if (estado === 'RECHAZADO') resumen.rechazados += 1
    else resumen.sinParte += 1

    if (requiereAccionDelTrabajador(estado)) resumen.pendientesDelTrabajador += 1
  }

  resumen.cumplimientoPct =
    resumen.total === 0
      ? 0
      : Math.round(((resumen.aprobados + resumen.enviados) / resumen.total) * 100)

  return resumen
}

export function ordenarPorPrioridad<T extends { estado: EstadoCumplimiento }>(filas: readonly T[]): T[] {
  return [...filas].sort((a, b) => {
    const diferencia = prioridadCumplimiento(a.estado) - prioridadCumplimiento(b.estado)
    if (diferencia !== 0) return diferencia
    return 0
  })
}

/**
 * Orden de atención del panel: primero lo que bloquea el cierre y, dentro del
 * mismo estado, quien lleva más días esperando. Empate estable por nombre para
 * que dos cargas seguidas pinten el mismo orden.
 */
export function ordenarPorAtencion<T extends { estado: EstadoCumplimiento; diasEspera: number; nombre: string }>(
  filas: readonly T[],
): T[] {
  return [...filas].sort((a, b) => {
    const prioridad = prioridadCumplimiento(a.estado) - prioridadCumplimiento(b.estado)
    if (prioridad !== 0) return prioridad
    const espera = b.diasEspera - a.diasEspera
    if (espera !== 0) return espera
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}
