import {
  ETIQUETAS_CUMPLIMIENTO,
  type EstadoCumplimiento,
} from '@/modules/reporting/domain/cumplimiento'
import { ETIQUETAS_RIESGO, type NivelRiesgo } from '@/modules/reporting/domain/riesgo'
import { ETIQUETAS_SEVERIDAD } from '@/modules/reporting/domain/severidad'

/**
 * Textos de la leyenda de colores del dashboard. Módulo puro (sin React) para
 * que los textos se puedan probar con el runner en entorno `node`: la vista
 * `LeyendaDashboard.tsx` solo les pone clases.
 *
 * Las etiquetas no se escriben aquí: se toman de los `ETIQUETAS_*` del dominio,
 * de modo que un cambio de vocabulario en una regla no deje la leyenda mintiendo.
 */
export type ItemLeyenda<Clave extends string = string> = {
  clave: Clave
  etiqueta: string
  descripcion: string
}

export type IndicadorLeyenda = {
  etiqueta: string
  descripcion: string
}

/**
 * `ETIQUETAS_SEVERIDAD.NEUTRO` es cadena vacía, así que el semáforo solo lista
 * los tres niveles que se pintan con píldora. El gris se explica en una nota.
 */
const SEVERIDADES_VISIBLES = ['ALERTA', 'AVISO', 'OK'] as const
type SeveridadVisible = (typeof SEVERIDADES_VISIBLES)[number]

const DESCRIPCIONES_SEVERIDAD: Record<SeveridadVisible, string> = {
  ALERTA: 'Fuera de rango: bloquea el cierre de la semana.',
  AVISO: 'Va justo: conviene actuar antes del viernes.',
  OK: 'En rango: sin acción pendiente.',
}

/** El orden da la prioridad de lectura; el `Record` obliga a no olvidar ninguno. */
const ORDEN_RIESGO: Record<NivelRiesgo, number> = {
  AGOTADO: 0,
  CRITICO: 1,
  AVISO: 2,
  OK: 3,
  SIN_PRESUPUESTO: 4,
  SIN_PLAZO: 5,
}

const DESCRIPCIONES_RIESGO: Record<NivelRiesgo, string> = {
  AGOTADO: 'Se ha consumido todo el presupuesto de horas.',
  CRITICO: 'El consumo supera claramente el ritmo del plazo.',
  AVISO: 'Consumo por encima de lo previsto: conviene revisarlo.',
  OK: 'Consumo y plazo avanzan en la misma proporción.',
  SIN_PRESUPUESTO: 'Sin horas de presupuesto: no se puede medir la desviación.',
  SIN_PLAZO: 'Sin fechas de inicio y fin: no se puede medir la desviación.',
}

/** Mismo orden que el ciclo de vida del parte, con `SIN_PARTE` al final. */
const ORDEN_ESTADO: Record<EstadoCumplimiento, number> = {
  BORRADOR: 0,
  ENVIADO: 1,
  APROBADO: 2,
  RECHAZADO: 3,
  BLOQUEADO: 4,
  SIN_PARTE: 5,
}

const DESCRIPCIONES_ESTADO: Record<EstadoCumplimiento, string> = {
  BORRADOR: 'En edición: todavía no cuenta como entregado.',
  ENVIADO: 'Esperando la revisión del encargado.',
  APROBADO: 'Revisado y aceptado: ya no se edita sin reabrir el parte.',
  RECHAZADO: 'Devuelto con motivo: hay que corregirlo y reenviarlo.',
  BLOQUEADO: 'Periodo cerrado: solo se edita reabriéndolo con motivo.',
  SIN_PARTE: 'La persona no ha creado parte esa semana.',
}

function clavesOrdenadas<Clave extends string>(orden: Record<Clave, number>): Clave[] {
  return (Object.keys(orden) as Clave[]).sort((a, b) => orden[a] - orden[b])
}

export const ITEMS_SEMAFORO: readonly ItemLeyenda<SeveridadVisible>[] = SEVERIDADES_VISIBLES.map(
  (clave) => ({
    clave,
    etiqueta: ETIQUETAS_SEVERIDAD[clave],
    descripcion: DESCRIPCIONES_SEVERIDAD[clave],
  }),
)

export const ITEMS_RIESGO: readonly ItemLeyenda<NivelRiesgo>[] = clavesOrdenadas(ORDEN_RIESGO).map(
  (clave) => ({
    clave,
    etiqueta: ETIQUETAS_RIESGO[clave],
    descripcion: DESCRIPCIONES_RIESGO[clave],
  }),
)

export const ITEMS_ESTADO: readonly ItemLeyenda<EstadoCumplimiento>[] = clavesOrdenadas(
  ORDEN_ESTADO,
).map((clave) => ({
  clave,
  etiqueta: ETIQUETAS_CUMPLIMIENTO[clave],
  descripcion: DESCRIPCIONES_ESTADO[clave],
}))

/** Qué mide cada tarjeta del hero. */
export const INDICADORES: readonly IndicadorLeyenda[] = [
  {
    etiqueta: 'Cumplimiento',
    descripcion: 'Porcentaje de partes enviados o aprobados sobre el total del equipo.',
  },
  {
    etiqueta: 'Pendientes',
    descripcion: 'Partes enviados que esperan tu revisión.',
  },
  {
    etiqueta: 'Sin enviar',
    descripcion: 'Personas que deben cargar o corregir sus horas.',
  },
  {
    etiqueta: 'En riesgo',
    descripcion:
      'Proyectos agotados, críticos o a vigilar. Se pinta en rojo si hay algún agotado o crítico y en ámbar si solo hay avisos.',
  },
  {
    etiqueta: 'Antigüedad máxima',
    descripcion:
      'Días que lleva esperando el parte más antiguo sin revisar. En el panel se muestra como texto; en el informe exportado usa el mismo semáforo.',
  },
]

export const NOTA_NEUTRO =
  'El gris no es un aviso: indica un dato que no se puede medir. No aparece en las cuatro tarjetas, sí en el informe exportado.'

export const NOTA_RIESGO_CABECERA =
  'La tarjeta En riesgo suma agotados, críticos y avisos: rojo si hay algún agotado o crítico, ámbar si solo hay avisos.'

export const NOTA_BLOQUEADO =
  'Bloqueado cuenta como aprobado en el porcentaje de cumplimiento y no aparece en la lista de personas que necesitan ayuda.'
