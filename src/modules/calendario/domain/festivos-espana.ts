/**
 * Precarga de festivos de referencia en España.
 *
 * Es un punto de partida editable, no una verdad legal: cada comunidad y cada
 * ayuntamiento publica su calendario laboral cada año, con traslados cuando un
 * festivo cae en domingo. El administrador revisa, corrige y publica el
 * calendario de su empresa; la base de datos es la fuente de verdad.
 *
 * Reglas cubiertas:
 * - Nacionales del artículo 37.2 del Estatuto de los Trabajadores.
 * - Viernes Santo y Lunes de Pascua, calculados a partir del domingo de Pascua.
 * - Festivo propio de cada comunidad autónoma.
 */

import { sumarDias, type FechaIso } from '@/modules/partes/domain/fechas'

export type AmbitoFestivo = 'NACIONAL' | 'CCAA' | 'PROVINCIA' | 'LOCAL' | 'EMPRESA'

export type FestivoCatalogo = {
  fecha: FechaIso
  nombre: string
  ambito: AmbitoFestivo
  comunidad?: string
}

export type Comunidad = { codigo: string; nombre: string }

/** Códigos ISO 3166-2:ES de las comunidades y ciudades autónomas. */
export const COMUNIDADES: readonly Comunidad[] = [
  { codigo: 'AN', nombre: 'Andalucía' },
  { codigo: 'AR', nombre: 'Aragón' },
  { codigo: 'AS', nombre: 'Asturias' },
  { codigo: 'CB', nombre: 'Cantabria' },
  { codigo: 'CE', nombre: 'Ceuta' },
  { codigo: 'CL', nombre: 'Castilla y León' },
  { codigo: 'CM', nombre: 'Castilla-La Mancha' },
  { codigo: 'CN', nombre: 'Canarias' },
  { codigo: 'CT', nombre: 'Cataluña' },
  { codigo: 'EX', nombre: 'Extremadura' },
  { codigo: 'GA', nombre: 'Galicia' },
  { codigo: 'IB', nombre: 'Illes Balears' },
  { codigo: 'MC', nombre: 'Región de Murcia' },
  { codigo: 'MD', nombre: 'Comunidad de Madrid' },
  { codigo: 'ML', nombre: 'Melilla' },
  { codigo: 'NC', nombre: 'Navarra' },
  { codigo: 'PV', nombre: 'País Vasco' },
  { codigo: 'RI', nombre: 'La Rioja' },
  { codigo: 'VC', nombre: 'Comunitat Valenciana' },
]

export function nombreComunidad(codigo: string): string | null {
  return COMUNIDADES.find((comunidad) => comunidad.codigo === codigo.toUpperCase())?.nombre ?? null
}

/**
 * Domingo de Pascua (algoritmo gregoriano de Meeus/Jones/Butcher) como
 * `YYYY-MM-DD`, calculado en UTC para no depender del reloj del servidor.
 */
export function pascua(anio: number): FechaIso {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1

  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function festivoFecha(fecha: FechaIso, nombre: string, ambito: AmbitoFestivo, comunidad?: string): FestivoCatalogo {
  return comunidad ? { fecha, nombre, ambito, comunidad } : { fecha, nombre, ambito }
}

/** Festivos nacionales, incluido el Viernes Santo. */
export function festivosNacionales(anio: number): FestivoCatalogo[] {
  const y = String(anio).padStart(4, '0')
  return [
    festivoFecha(`${y}-01-01`, 'Año Nuevo', 'NACIONAL'),
    festivoFecha(`${y}-01-06`, 'Epifanía del Señor', 'NACIONAL'),
    festivoFecha(sumarDias(pascua(anio), -2), 'Viernes Santo', 'NACIONAL'),
    festivoFecha(`${y}-05-01`, 'Fiesta del Trabajo', 'NACIONAL'),
    festivoFecha(`${y}-08-15`, 'Asunción de la Virgen', 'NACIONAL'),
    festivoFecha(`${y}-10-12`, 'Fiesta Nacional de España', 'NACIONAL'),
    festivoFecha(`${y}-11-01`, 'Todos los Santos', 'NACIONAL'),
    festivoFecha(`${y}-12-06`, 'Día de la Constitución Española', 'NACIONAL'),
    festivoFecha(`${y}-12-08`, 'Inmaculada Concepción', 'NACIONAL'),
    festivoFecha(`${y}-12-25`, 'Natividad del Señor', 'NACIONAL'),
  ]
}

/**
 * Festivo propio y fiestas de regla fija de cada comunidad. Los años en que el
 * día cae en domingo la comunidad suele trasladarlo: esa decisión se corrige
 * en la pantalla de calendario, no se adivina aquí.
 */
const FESTIVOS_POR_COMUNIDAD: Record<string, readonly { mes: number; dia: number; nombre: string }[]> = {
  AN: [{ mes: 2, dia: 28, nombre: 'Día de Andalucía' }],
  AR: [{ mes: 4, dia: 23, nombre: 'San Jorge' }],
  AS: [{ mes: 9, dia: 8, nombre: 'Día de Asturias' }],
  CB: [{ mes: 7, dia: 28, nombre: 'Día de las Instituciones de Cantabria' }],
  CE: [{ mes: 9, dia: 2, nombre: 'Día de Ceuta' }],
  CL: [{ mes: 4, dia: 23, nombre: 'Día de Castilla y León' }],
  CM: [{ mes: 5, dia: 31, nombre: 'Día de Castilla-La Mancha' }],
  CN: [{ mes: 5, dia: 30, nombre: 'Día de Canarias' }],
  CT: [
    { mes: 9, dia: 11, nombre: 'Diada Nacional de Catalunya' },
    { mes: 12, dia: 26, nombre: 'Sant Esteve' },
  ],
  EX: [{ mes: 9, dia: 8, nombre: 'Día de Extremadura' }],
  GA: [{ mes: 7, dia: 25, nombre: 'Santiago Apóstol' }],
  IB: [{ mes: 3, dia: 1, nombre: 'Día de les Illes Balears' }],
  MC: [{ mes: 6, dia: 9, nombre: 'Día de la Región de Murcia' }],
  MD: [{ mes: 5, dia: 2, nombre: 'Fiesta de la Comunidad de Madrid' }],
  ML: [{ mes: 9, dia: 17, nombre: 'Día de Melilla' }],
  NC: [{ mes: 12, dia: 3, nombre: 'San Francisco Javier' }],
  PV: [{ mes: 7, dia: 25, nombre: 'Santiago Apóstol' }],
  RI: [{ mes: 6, dia: 9, nombre: 'Día de La Rioja' }],
  VC: [{ mes: 10, dia: 9, nombre: 'Día de la Comunitat Valenciana' }],
}

/** Comunidades que trasladan a lunes el Lunes de Pascua. */
const COMUNIDADES_CON_LUNES_DE_PASCUA = new Set(['CT', 'IB', 'NC', 'PV', 'RI', 'VC'])

export function festivosComunidad(anio: number, comunidad: string): FestivoCatalogo[] {
  const codigo = comunidad.toUpperCase()
  const nombre = nombreComunidad(codigo)
  if (!nombre) return []

  const y = String(anio).padStart(4, '0')
  const fijos = (FESTIVOS_POR_COMUNIDAD[codigo] ?? []).map((fijo) =>
    festivoFecha(
      `${y}-${String(fijo.mes).padStart(2, '0')}-${String(fijo.dia).padStart(2, '0')}`,
      fijo.nombre,
      'CCAA',
      codigo,
    ),
  )

  if (COMUNIDADES_CON_LUNES_DE_PASCUA.has(codigo)) {
    fijos.push(festivoFecha(sumarDias(pascua(anio), 1), 'Lunes de Pascua', 'CCAA', codigo))
  }

  return fijos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
}

/**
 * Fusiona catálogos con precedencia local > provincia > CCAA > nacional >
 * empresa: a igualdad de fecha gana el ámbito más concreto y, dentro del mismo
 * ámbito, el último declarado. El resultado queda ordenado por fecha.
 */
const PRECEDENCIA: Record<AmbitoFestivo, number> = {
  LOCAL: 0,
  PROVINCIA: 1,
  CCAA: 2,
  NACIONAL: 3,
  EMPRESA: 4,
}

export function fusionarFestivos(...listas: readonly FestivoCatalogo[][]): FestivoCatalogo[] {
  const porFecha = new Map<FechaIso, FestivoCatalogo>()

  for (const lista of listas) {
    for (const festivo of lista) {
      const anterior = porFecha.get(festivo.fecha)
      if (!anterior || PRECEDENCIA[festivo.ambito] <= PRECEDENCIA[anterior.ambito]) {
        porFecha.set(festivo.fecha, festivo)
      }
    }
  }

  return [...porFecha.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
}

/** Nacionales, comunidad y festivos propios de empresa, ya fusionados. */
export function festivosDeReferencia(anio: number, comunidad?: string): FestivoCatalogo[] {
  const nacionales = festivosNacionales(anio)
  const autonomicos = comunidad ? festivosComunidad(anio, comunidad) : []
  return fusionarFestivos(nacionales, autonomicos)
}
