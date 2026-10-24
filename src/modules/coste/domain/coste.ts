/**
 * Dominio puro de coste. Sin I/O y sin coma flotante para importes: todo se
 * expresa en céntimos enteros y los cálculos se redondean una sola vez.
 */

export type Fecha = string

export type TarifaCoste = {
  id: string
  empleadoId: string | null
  categoria: string | null
  importeHoraCents: number
  desde: Fecha
  hasta: Fecha | null
  activo: boolean
}

export type Presupuesto = {
  id: string
  version: number
  importeCents: number
  horasPresupuesto: number | null
}

export type LineaCosteCalculada = {
  importeCents: number
  costeHoraCents: number | null
  tarifaId: string | null
  sinTarifa: boolean
}

export type EjecucionPresupuesto = {
  presupuestoCents: number
  gastadoCents: number
  restanteCents: number
  porcentaje: number
  excedido: boolean
}

/** Una tarifa cubre la fecha si su vigencia es inclusiva en ambos extremos. */
export function tarifaVigenteEn(tarifa: TarifaCoste, fecha: Fecha): boolean {
  if (!tarifa.activo) return false
  if (tarifa.desde > fecha) return false
  return tarifa.hasta === null || tarifa.hasta >= fecha
}

function masReciente(a: TarifaCoste, b: TarifaCoste): number {
  if (a.desde !== b.desde) return a.desde < b.desde ? 1 : -1
  return a.id < b.id ? 1 : -1
}

/**
 * Tarifa aplicable a una fecha. La tarifa de empleado prevalece sobre la de
 * categoría; dentro del mismo ámbito gana la vigencia que empezó más tarde.
 */
export function tarifaAplicable(
  tarifas: readonly TarifaCoste[],
  fecha: Fecha,
  opciones: { empleadoId: string; categoria: string | null },
): TarifaCoste | null {
  const vigentes = tarifas.filter((tarifa) => tarifaVigenteEn(tarifa, fecha))
  const delEmpleado = vigentes
    .filter((tarifa) => tarifa.empleadoId === opciones.empleadoId)
    .sort(masReciente)
  if (delEmpleado[0]) return delEmpleado[0]

  const categoria = opciones.categoria?.trim()
  if (!categoria) return null

  const deCategoria = vigentes.filter((tarifa) => tarifa.categoria === categoria).sort(masReciente)
  return deCategoria[0] ?? null
}

/** Vigencia inclusiva: dos tramos se solapan si comparten al menos un día. */
export function vigenciasSolapadas(
  a: { desde: Fecha; hasta: Fecha | null },
  b: { desde: Fecha; hasta: Fecha | null },
): boolean {
  const finA = a.hasta ?? '9999-12-31'
  const finB = b.hasta ?? '9999-12-31'
  return a.desde <= finB && b.desde <= finA
}

/** Valida que una tarifa tenga ámbito y un rango de fechas coherente. */
export function validarTarifa(datos: {
  empleadoId: string | null
  categoria: string | null
  importeHoraCents: number
  desde: Fecha
  hasta: Fecha | null
}): { campo: string; mensaje: string } | null {
  if (!Number.isInteger(datos.importeHoraCents) || datos.importeHoraCents < 0) {
    return { campo: 'importe', mensaje: 'El importe debe ser un número entero de céntimos' }
  }
  if (!datos.empleadoId && !datos.categoria?.trim()) {
    return { campo: 'ambito', mensaje: 'Indica un empleado o una categoría' }
  }
  if (datos.hasta !== null && datos.hasta < datos.desde) {
    return { campo: 'hasta', mensaje: 'La fecha final no puede ser anterior a la inicial' }
  }
  return null
}

/** Coste de un tramo de minutos. Redondeo al céntimo, una única vez. */
export function costeDeMinutos(minutos: number, importeHoraCents: number): number {
  if (!Number.isInteger(minutos) || minutos <= 0) return 0
  if (!Number.isInteger(importeHoraCents) || importeHoraCents <= 0) return 0
  return Math.round((minutos * importeHoraCents) / 60)
}

/**
 * Importe de una línea a partir de las tarifas disponibles. Sin tarifa vigente
 * devuelve importe 0 y marca `sinTarifa` para avisar, nunca para bloquear.
 */
export function calcularLinea(
  linea: { fecha: Fecha; minutos: number },
  tarifas: readonly TarifaCoste[],
  opciones: { empleadoId: string; categoria: string | null },
): LineaCosteCalculada {
  const tarifa = tarifaAplicable(tarifas, linea.fecha, opciones)
  if (!tarifa) {
    return { importeCents: 0, costeHoraCents: null, tarifaId: null, sinTarifa: true }
  }

  return {
    importeCents: costeDeMinutos(linea.minutos, tarifa.importeHoraCents),
    costeHoraCents: tarifa.importeHoraCents,
    tarifaId: tarifa.id,
    sinTarifa: false,
  }
}

/**
 * Versión vigente del presupuesto: la de mayor número, porque las versiones
 * son inmutables y no se reescribe el histórico.
 */
export function presupuestoVigente(presupuestos: readonly Presupuesto[]): Presupuesto | null {
  if (presupuestos.length === 0) return null
  return presupuestos.reduce((vigente, actual) => (actual.version > vigente.version ? actual : vigente))
}

export function ejecucionPresupuesto(gastadoCents: number, presupuestoCents: number): EjecucionPresupuesto {
  const gastado = Math.max(0, Math.trunc(gastadoCents))
  const presupuesto = Math.max(0, Math.trunc(presupuestoCents))
  const porcentaje = presupuesto === 0 ? 0 : Math.round((gastado * 10_000) / presupuesto) / 100

  return {
    presupuestoCents: presupuesto,
    gastadoCents: gastado,
    restanteCents: presupuesto - gastado,
    porcentaje,
    excedido: presupuesto > 0 && gastado > presupuesto,
  }
}

/** Suma importes en céntimos sin acumular error. */
export function sumarImportes(importes: readonly number[]): number {
  return importes.reduce((total, importe) => total + Math.trunc(importe), 0)
}

/**
 * Formatea céntimos como euros con separadores españoles. Se usa en informes y
 * en la interfaz; no depende del locale del proceso.
 */
export function formatearEuros(cents: number): string {
  const negativo = cents < 0
  const absoluto = Math.abs(Math.trunc(cents))
  const euros = Math.floor(absoluto / 100)
  const centimos = String(absoluto % 100).padStart(2, '0')
  const miles = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negativo ? '-' : ''}${miles},${centimos} €`
}

/** Convierte euros del formulario a céntimos enteros; null si no es válido. */
export function eurosACentimos(texto: string): number | null {
  const limpio = texto.trim().replace(/\./g, '').replace(',', '.')
  if (limpio === '') return null
  const euros = Number(limpio)
  if (!Number.isFinite(euros) || euros < 0) return null
  return Math.round(euros * 100)
}
