/**
 * Constantes y utilidades puras del seed de demostración.
 *
 * El seed se apoya en las mismas funciones de dominio que la aplicación
 * (`resolverDia`, `computarSemana`, `calcularLinea`, `evaluarRiesgo`) para que
 * los datos sembrados no sean una copia paralela de las reglas de negocio.
 * Este módulo no toca la base de datos: solo describe el escenario.
 */

import type { EstadoParte, Rol, TipoHora } from '@/db/schema'
import type { TarifaCoste } from '@/modules/coste/domain/coste'
import type { ReglaComputo } from '@/modules/computo/domain/reglas'
import { diaSemanaIso } from '@/modules/calendario/domain/calendario'
import { sumarDias, type FechaIso } from '@/modules/partes/domain/fechas'
import { evaluarRiesgo, type NivelRiesgo } from '@/modules/reporting/domain/riesgo'

export const CODIGO_EMPRESA_DEMO = 'DEMO'

/** Semanas ISO generadas: la actual y trece anteriores. */
export const SEMANAS_DEMO = 14

/** Cuentas destacadas del login. El nombre es la clave compartida con el seed. */
export const NOMBRE_ADMIN_DEMO = 'Leo Messi'
export const NOMBRE_ENCARGADO_DEMO = 'Daniel Rabinovich'
export const NOMBRE_TRABAJADOR_DEMO = 'Juan Maldacena'

export const NOMBRES_ENCARGADOS = [
  NOMBRE_ENCARGADO_DEMO,
  'Rosario Alcaide',
  'Ignacio Peñalver',
  'Mercedes Ochoa',
  'Joaquín Valero',
  'Silvia Marchena',
] as const

export const NOMBRES_TRABAJADORES = [
  NOMBRE_TRABAJADOR_DEMO,
  'Rubén Castillo',
  'Ismael Ortega',
  'Jorge Villanueva',
  'Sergio Quesada',
  'Marta Salazar',
  'Lucía Ferreiro',
  'Nuria Peña',
  'Carmen Iglesias',
  'Esther Oviedo',
  'Pablo Rueda',
  'Andrés Maldonado',
  'David Bermejo',
  'Raúl Torralba',
  'Víctor Sanchís',
  'Alberto Campo',
  'Rubén Losada',
  'Emilio Pardo',
  'Fermín Barral',
  'Gonzalo Rioja',
  'Alicia Terrón',
  'Beatriz Vilar',
  'Cristina Lamas',
  'Diana Souto',
  'Elena Fidalgo',
  'Fátima Amador',
  'Gema Villar',
  'Helena Carballo',
  'Irene Castaño',
  'Julia Mosquera',
  'Kevin Solís',
  'Lorenzo Puente',
  'Manuel Cañizares',
  'Nicolás Arribas',
  'Óscar Fábregas',
  'Patricia Segura',
  'Quique Duran',
  'Ramón Espada',
  'Samuel Bonet',
  'Tomás Verdugo',
  'Unai Echeverría',
  'Valentín Rivas',
  'Xavier Cortés',
] as const

/** Categorías de convenio que usan las tarifas de coste y las reglas de cómputo. */
export const CATEGORIAS = {
  ADMINISTRACION: 'Administración',
  ENCARGADO: 'Encargado',
  OFICIAL_1: 'Oficial 1ª',
  OFICIAL_2: 'Oficial 2ª',
  PEON: 'Peón',
  TECNICO: 'Técnico',
} as const

const CATEGORIAS_TRABAJADOR = [
  CATEGORIAS.OFICIAL_1,
  CATEGORIAS.OFICIAL_2,
  CATEGORIAS.TECNICO,
  CATEGORIAS.OFICIAL_1,
  CATEGORIAS.PEON,
] as const

export type ProyectoDemo = {
  nombre: string
  activo: boolean
  /** Nivel que debe alcanzar el motor de riesgo con los datos sembrados. */
  nivel: NivelRiesgo
}

/**
 * Once proyectos: uno por cada nivel de riesgo que puede pintar el dashboard y
 * uno inactivo. El reparto doble de niveles evita que la pantalla de proyectos
 * muestre una sola fila por color.
 */
export const PROYECTOS_DEMO: readonly ProyectoDemo[] = [
  { nombre: 'Rehabilitación Edificio Colón', activo: true, nivel: 'AGOTADO' },
  { nombre: 'Ampliación Nave Industrial Norte', activo: true, nivel: 'CRITICO' },
  { nombre: 'Urbanización Sector Residencial Sur', activo: true, nivel: 'AVISO' },
  { nombre: 'Reforma Hotel Miramar', activo: true, nivel: 'OK' },
  { nombre: 'Centro Comercial Las Fuentes', activo: true, nivel: 'SIN_PRESUPUESTO' },
  { nombre: 'Aparcamiento Subterráneo Plaza Mayor', activo: true, nivel: 'SIN_PLAZO' },
  { nombre: 'Colegio Público San Blas', activo: true, nivel: 'AGOTADO' },
  { nombre: 'Rotonda de acceso Polígono Este', activo: true, nivel: 'CRITICO' },
  { nombre: 'Viviendas Unifamiliares La Vega', activo: true, nivel: 'AVISO' },
  { nombre: 'Adecuación Local Comercial Centro', activo: true, nivel: 'OK' },
  { nombre: 'Obra Civil Corredor Norte', activo: false, nivel: 'OK' },
]

export const TAREAS_DEMO = [
  { codigo: 'T01', nombre: 'Jefatura de obra' },
  { codigo: 'T02', nombre: 'Ejecución obra' },
  { codigo: 'T03', nombre: 'Oficina técnica' },
  { codigo: 'T04', nombre: 'Remates y limpieza' },
] as const

export type CalendarioDemo = {
  codigo: string
  nombre: string
  ambito: 'NACIONAL' | 'CCAA' | 'PROVINCIA' | 'LOCAL' | 'EMPRESA'
  comunidad: string | null
  diasSemana: number[]
  horasDiariasMin: number | null
  esPredeterminado: boolean
  activo: boolean
}

export const CALENDARIOS_DEMO: readonly CalendarioDemo[] = [
  {
    codigo: 'DEMO-MD',
    nombre: 'Calendario Levitec Demo (Madrid)',
    ambito: 'CCAA',
    comunidad: 'MD',
    diasSemana: [1, 2, 3, 4, 5],
    horasDiariasMin: 480,
    esPredeterminado: true,
    activo: true,
  },
  {
    codigo: 'DEMO-SAB',
    nombre: 'Calendario de obra con sábados',
    ambito: 'EMPRESA',
    comunidad: 'MD',
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDiariasMin: 420,
    esPredeterminado: false,
    activo: true,
  },
  {
    codigo: 'DEMO-ANT',
    nombre: 'Calendario histórico de 2024',
    ambito: 'EMPRESA',
    comunidad: 'MD',
    diasSemana: [1, 2, 3, 4, 5],
    horasDiariasMin: 480,
    esPredeterminado: false,
    activo: false,
  },
]

export type ReglaDemo = {
  tipoHora: TipoHora
  factorBps: number
  aplicaEn: 'TODO' | 'LABORABLE' | 'FESTIVO'
  topeDiarioMin: number | null
  topeSemanalMin: number | null
  requiereAutorizacion: boolean
  prioridad: number
}

export type ConvenioDemo = {
  codigo: string
  nombre: string
  activo: boolean
  version: number
  reglas: readonly ReglaDemo[]
}

/**
 * Convenios con perfiles distintos para que el detalle del parte muestre tipos
 * de hora diferentes: extra con tope que desborda a normal, complementaria y
 * festiva a 1,5.
 */
export const CONVENIOS_DEMO: readonly ConvenioDemo[] = [
  {
    codigo: 'OBRA',
    nombre: 'Convenio de la construcción (obra)',
    activo: true,
    version: 2,
    reglas: [
      {
        tipoHora: 'EXTRA',
        factorBps: 12_500,
        aplicaEn: 'LABORABLE',
        topeDiarioMin: 480,
        topeSemanalMin: 2_400,
        requiereAutorizacion: true,
        prioridad: 10,
      },
      {
        tipoHora: 'FESTIVA',
        factorBps: 15_000,
        aplicaEn: 'FESTIVO',
        topeDiarioMin: null,
        topeSemanalMin: null,
        requiereAutorizacion: true,
        prioridad: 10,
      },
    ],
  },
  {
    codigo: 'OFICINA',
    nombre: 'Convenio de oficinas técnicas',
    activo: true,
    version: 3,
    reglas: [
      {
        tipoHora: 'NORMAL',
        factorBps: 10_000,
        aplicaEn: 'LABORABLE',
        topeDiarioMin: null,
        topeSemanalMin: null,
        requiereAutorizacion: false,
        prioridad: 100,
      },
      {
        tipoHora: 'FESTIVA',
        factorBps: 15_000,
        aplicaEn: 'FESTIVO',
        topeDiarioMin: null,
        topeSemanalMin: null,
        requiereAutorizacion: false,
        prioridad: 10,
      },
    ],
  },
  {
    codigo: 'FORMACION',
    nombre: 'Convenio de formación y prácticas',
    activo: true,
    version: 1,
    reglas: [
      {
        tipoHora: 'COMPLEMENTARIA',
        factorBps: 11_000,
        aplicaEn: 'LABORABLE',
        topeDiarioMin: 480,
        topeSemanalMin: null,
        requiereAutorizacion: false,
        prioridad: 10,
      },
      {
        tipoHora: 'FESTIVA',
        factorBps: 15_000,
        aplicaEn: 'FESTIVO',
        topeDiarioMin: null,
        topeSemanalMin: null,
        requiereAutorizacion: false,
        prioridad: 10,
      },
    ],
  },
  {
    codigo: 'ANTIGUO',
    nombre: 'Convenio antiguo (inactivo)',
    activo: false,
    version: 1,
    reglas: [
      {
        tipoHora: 'NORMAL',
        factorBps: 10_000,
        aplicaEn: 'TODO',
        topeDiarioMin: null,
        topeSemanalMin: null,
        requiereAutorizacion: false,
        prioridad: 100,
      },
    ],
  },
]

export type TarifaDemo = {
  /** `null` = tarifa de categoría. */
  categoria: string | null
  /** Índice del empleado cuando la tarifa es nominal. */
  indiceEmpleado: number | null
  importeHoraCents: number
  activo: boolean
  /** Antigüedad en días respecto a hoy de la fecha de inicio. */
  desdeDias: number
  /** Antigüedad en días respecto a hoy de la fecha final; `null` = sin fin. */
  hastaDias: number | null
}

export const TARIFAS_DEMO: readonly TarifaDemo[] = [
  { categoria: CATEGORIAS.OFICIAL_1, indiceEmpleado: null, importeHoraCents: 2_600, activo: true, desdeDias: -730, hastaDias: null },
  { categoria: CATEGORIAS.OFICIAL_2, indiceEmpleado: null, importeHoraCents: 2_400, activo: true, desdeDias: -730, hastaDias: null },
  { categoria: CATEGORIAS.TECNICO, indiceEmpleado: null, importeHoraCents: 3_200, activo: true, desdeDias: -730, hastaDias: null },
  { categoria: CATEGORIAS.ENCARGADO, indiceEmpleado: null, importeHoraCents: 3_600, activo: true, desdeDias: -730, hastaDias: null },
  { categoria: CATEGORIAS.ADMINISTRACION, indiceEmpleado: null, importeHoraCents: 4_000, activo: true, desdeDias: -730, hastaDias: null },
  // Caducada y desactivada: deja las líneas de peón sin tarifa, que es justo lo
  // que la pantalla de costes debe saber avisar.
  { categoria: CATEGORIAS.PEON, indiceEmpleado: null, importeHoraCents: 2_500, activo: false, desdeDias: -730, hastaDias: -90 },
  // Histórico nominal del trabajador destacado, para ver precedencia y versionado.
  { categoria: null, indiceEmpleado: 7, importeHoraCents: 2_500, activo: false, desdeDias: -400, hastaDias: -70 },
  { categoria: null, indiceEmpleado: 7, importeHoraCents: 2_750, activo: true, desdeDias: -69, hastaDias: null },
]

export type TipoAusenciaDemo = {
  codigo: string
  nombre: string
  computaSaldo: boolean
  requiereAprobacion: boolean
  activo: boolean
}

export const TIPOS_AUSENCIA_DEMO: readonly TipoAusenciaDemo[] = [
  { codigo: 'VACACIONES', nombre: 'Vacaciones', computaSaldo: true, requiereAprobacion: true, activo: true },
  { codigo: 'ASUNTOS_PROPIOS', nombre: 'Asuntos propios', computaSaldo: true, requiereAprobacion: true, activo: true },
  { codigo: 'BAJA', nombre: 'Baja médica', computaSaldo: false, requiereAprobacion: true, activo: true },
  { codigo: 'PERMISO', nombre: 'Permiso retribuido', computaSaldo: false, requiereAprobacion: false, activo: true },
  { codigo: 'FORMACION', nombre: 'Formación (histórico)', computaSaldo: false, requiereAprobacion: false, activo: false },
]

export type EstadoAusenciaDemo = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'

export type SolicitudAusenciaDemo = {
  indiceEmpleado: number
  codigoTipo: string
  /** Día de inicio respecto al lunes de la semana actual (negativo = pasado). */
  desdeDias: number
  /** Día final respecto al lunes de la semana actual. */
  hastaDias: number
  /** Minutos de ausencia parcial; `null` = jornada completa. */
  minutos: number | null
  estado: EstadoAusenciaDemo
  motivoSolicitud: string
  motivoResolucion: string | null
}

/**
 * Solicitudes de ausencia del demo. Las aprobadas de jornada completa o parcial
 * se descuentan también de las imputaciones, para que la rejilla y el cómputo
 * no muestren horas trabajadas en días de ausencia.
 */
export const AUSENCIAS_DEMO: readonly SolicitudAusenciaDemo[] = [
  {
    indiceEmpleado: 7,
    codigoTipo: 'ASUNTOS_PROPIOS',
    desdeDias: 2,
    hastaDias: 2,
    minutos: 240,
    estado: 'APROBADA',
    motivoSolicitud: 'Trámite médico por la mañana',
    motivoResolucion: 'Aprobado: se recupera por la tarde',
  },
  {
    indiceEmpleado: 6,
    codigoTipo: 'PERMISO',
    desdeDias: 3,
    hastaDias: 3,
    minutos: 180,
    estado: 'SOLICITADA',
    motivoSolicitud: 'Reunión de comunidad de vecinos',
    motivoResolucion: null,
  },
  {
    indiceEmpleado: 15,
    codigoTipo: 'ASUNTOS_PROPIOS',
    desdeDias: 4,
    hastaDias: 4,
    minutos: 180,
    estado: 'SOLICITADA',
    motivoSolicitud: 'Cita en el banco',
    motivoResolucion: null,
  },
  {
    indiceEmpleado: 12,
    codigoTipo: 'VACACIONES',
    desdeDias: 7,
    hastaDias: 8,
    minutos: null,
    estado: 'SOLICITADA',
    motivoSolicitud: 'Puente de noviembre',
    motivoResolucion: null,
  },
  {
    indiceEmpleado: 14,
    codigoTipo: 'VACACIONES',
    desdeDias: -7,
    hastaDias: -3,
    minutos: null,
    estado: 'APROBADA',
    motivoSolicitud: 'Descanso anual',
    motivoResolucion: 'Aprobado por el encargado',
  },
  {
    indiceEmpleado: 19,
    codigoTipo: 'ASUNTOS_PROPIOS',
    desdeDias: -21,
    hastaDias: -21,
    minutos: null,
    estado: 'RECHAZADA',
    motivoSolicitud: 'Asunto personal',
    motivoResolucion: 'Rechazado: hay entrega de obra ese día',
  },
  {
    indiceEmpleado: 26,
    codigoTipo: 'BAJA',
    desdeDias: -28,
    hastaDias: -27,
    minutos: null,
    estado: 'ANULADA',
    motivoSolicitud: 'Baja por gripe',
    motivoResolucion: 'Anulada por el propio empleado: no hubo baja',
  },
  {
    indiceEmpleado: 28,
    codigoTipo: 'BAJA',
    desdeDias: -35,
    hastaDias: -21,
    minutos: null,
    estado: 'APROBADA',
    motivoSolicitud: 'Baja médica con parte',
    motivoResolucion: 'Aprobada: se aporta parte de baja',
  },
  {
    indiceEmpleado: 31,
    codigoTipo: 'PERMISO',
    desdeDias: -49,
    hastaDias: -49,
    minutos: 480,
    estado: 'APROBADA',
    motivoSolicitud: 'Matrimonio de un familiar directo',
    motivoResolucion: 'Permiso retribuido',
  },
]

/** Motivos de rechazo verosímiles, repartidos de forma determinista. */
export const MOTIVOS_RECHAZO = [
  'Faltan horas del jueves y la tarea no coincide con la asignación',
  'Revisa el reparto del miércoles: no puede superar 8 horas en una sola tarea',
  'Hay horas imputadas a un proyecto cerrado. Corrige la tarea antes de reenviar',
  'La nota de la imputación del viernes no describe el trabajo realizado',
] as const

/** Casos límite que el seed fuerza de forma explícita. */
export const CASOS = {
  /** Empleado con dos semanas de 50 h y un día de más de 12 h. */
  indiceSobrecarga: 10,
  /** Empleado que trabaja un festivo (computa como FESTIVA). */
  indiceFestivoTrabajado: 9,
  /** Empleado a jornada parcial (20 h semanales). */
  indiceJornadaParcial: 20,
  /** Empleados con calendario de lunes a sábado. */
  indicesCalendarioSabado: [21, 22, 23] as readonly number[],
  /** Empleado desactivado: aparece como inactivo en administración. */
  indiceInactivo: 49,
  /** Parte en borrador sin ninguna hora: caso real que conviene ver. */
  indiceParteVacio: 4,
  semanaParteVacio: 0,
  /** Semanas (desplazamiento) con exceso de horas. */
  semanasSobrecarga: [3, 6] as readonly number[],
  /** Semana en la que se trabaja el festivo de empresa. */
  semanaFestivoTrabajado: 5,
  /** Semanas sin parte para mostrar el estado SIN_PARTE en la vista de equipo. */
  sinParteSemanaActual: [3, 11, 19, 27] as readonly number[],
  sinParteSemanaAnterior: [14, 33] as readonly number[],
} as const

/* -------------------------------------------------------------------------- */
/* Tipos compartidos entre el orquestador y los builders de fase 2            */
/* -------------------------------------------------------------------------- */

export type EmpleadoSeed = {
  id: string
  codigo: string
  nombre: string
  indice: number
  categoria: string
  activo: boolean
}

export type UsuarioSeed = {
  id: string
  nombre: string
  email: string
  rol: Rol
  empleadoId: string
  indiceEmpleado: number
  activo: boolean
}

export type ProyectoSeed = {
  id: string
  codigo: string
  nombre: string
  indice: number
  activo: boolean
  nivel: NivelRiesgo
}

export type TareaSeed = {
  id: string
  proyectoId: string
  codigo: string
}

export type ParteSeed = {
  id: string
  empleadoId: string
  indiceEmpleado: number
  usuarioId: string
  rol: Rol
  estado: EstadoParte
  isoYear: number
  isoWeek: number
  weekStart: FechaIso
  /** Fechas con imputación: el cierre mensual filtra por fecha, no por semana. */
  fechas: FechaIso[]
  totalMinutos: number
  enviadoAt: Date | null
  revisadoPor: string | null
  revisadoAt: Date | null
  motivoRechazo: string | null
  version: number
}

/** Calendario ya materializado en memoria para resolver días sin consultar. */
export type CalendarioSeed = {
  id: string
  codigo: string
  version: number
  diasSemana: readonly number[]
  /** Solo fechas con festivo. `true` si el festivo está abierto. */
  festivos: Map<FechaIso, boolean>
  /** Solo fechas con excepción. `true` si abre el día. */
  excepciones: Map<FechaIso, boolean>
  horasDiariasMin: number | null
}

export type ConvenioSeed = {
  id: string
  codigo: string
  nombre: string
  version: number
  reglas: ReglaComputo[]
}

export type TarifaSeed = TarifaCoste

/* -------------------------------------------------------------------------- */
/* Utilidades puras                                                           */
/* -------------------------------------------------------------------------- */

/** Generador determinista: la misma carga produce siempre los mismos datos. */
export function crearAleatorio(semilla: number): () => number {
  let estado = semilla >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function enLotes<T>(items: readonly T[], tamano = 400): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < items.length; i += tamano) {
    lotes.push(items.slice(i, i + tamano))
  }
  return lotes
}

/** Evita el `!` cuando `noUncheckedIndexedAccess` obliga a comprobar el índice. */
export function exigir<T>(valor: T | undefined, mensaje: string): T {
  if (valor === undefined) throw new Error(mensaje)
  return valor
}

export function indiceA<T>(items: readonly T[], indice: number, mensaje: string): T {
  return exigir(items[indice], mensaje)
}

/** Misma precedencia que `resolverDia`: excepción, festivo cerrado, día base. */
export function esDiaLaborable(calendario: CalendarioSeed, fecha: FechaIso): boolean {
  const excepcion = calendario.excepciones.get(fecha)
  if (excepcion !== undefined) return excepcion

  const festivo = calendario.festivos.get(fecha)
  if (festivo === false) return false

  return calendario.diasSemana.includes(diaSemanaIso(fecha))
}

/** Un día cuenta como festivo para el motor cuando el festivo cierra el día. */
export function esDiaFestivo(calendario: CalendarioSeed, fecha: FechaIso): boolean {
  if (calendario.excepciones.has(fecha)) return false
  return calendario.festivos.get(fecha) === false
}

export const CICLO_ESTADOS: readonly EstadoParte[] = [
  'BORRADOR',
  'ENVIADO',
  'RECHAZADO',
  'APROBADO',
  'ENVIADO',
  'APROBADO',
]

/**
 * Estados forzados de las tres cuentas destacadas. Así el acceso rápido entra
 * directamente en un caso distinto: borrador editable, rechazo con motivo y
 * parte enviado pendiente de aprobar.
 */
export const ESTADOS_DESTACADOS: Readonly<Record<string, Readonly<Record<number, EstadoParte>>>> = {
  [NOMBRE_ADMIN_DEMO]: { 0: 'APROBADO', 1: 'ENVIADO', 2: 'APROBADO' },
  [NOMBRE_ENCARGADO_DEMO]: { 0: 'ENVIADO', 1: 'APROBADO', 2: 'RECHAZADO' },
  [NOMBRE_TRABAJADOR_DEMO]: { 0: 'BORRADOR', 1: 'RECHAZADO', 2: 'ENVIADO', 3: 'APROBADO' },
}

export function estadoDeParte(
  nombre: string,
  indiceEmpleado: number,
  desplazamiento: number,
): EstadoParte {
  const forzado = ESTADOS_DESTACADOS[nombre]?.[desplazamiento]
  if (forzado) return forzado
  if (desplazamiento >= 2) return 'APROBADO'

  const indice = (indiceEmpleado + desplazamiento * 2) % CICLO_ESTADOS.length
  return CICLO_ESTADOS[indice] ?? 'APROBADO'
}

/** Semanas en las que un empleado no tiene parte: alimenta el estado SIN_PARTE. */
export function sinParte(indiceEmpleado: number, desplazamiento: number): boolean {
  if (desplazamiento === 0) return CASOS.sinParteSemanaActual.includes(indiceEmpleado)
  if (desplazamiento === 1) return CASOS.sinParteSemanaAnterior.includes(indiceEmpleado)
  return false
}

/** Nombres de los tres roles, en el orden en que se crean los empleados. */
export function nombreEmpleadoDemo(indice: number): string {
  if (indice === 0) return NOMBRE_ADMIN_DEMO
  if (indice <= NOMBRES_ENCARGADOS.length) {
    return indiceA(NOMBRES_ENCARGADOS, indice - 1, 'Encargado sin nombre')
  }
  return indiceA(
    NOMBRES_TRABAJADORES,
    indice - 1 - NOMBRES_ENCARGADOS.length,
    'Trabajador sin nombre',
  )
}

export function categoriaEmpleadoDemo(indice: number): string {
  if (indice === 0) return CATEGORIAS.ADMINISTRACION
  if (indice <= NOMBRES_ENCARGADOS.length) return CATEGORIAS.ENCARGADO
  return indiceA(
    CATEGORIAS_TRABAJADOR,
    (indice - 1 - NOMBRES_ENCARGADOS.length) % CATEGORIAS_TRABAJADOR.length,
    'Categoría sin nombre',
  )
}

export function rolEmpleadoDemo(indice: number): Rol {
  if (indice === 0) return 'ADMIN'
  if (indice <= NOMBRES_ENCARGADOS.length) return 'ENCARGADO'
  return 'TRABAJADOR'
}

export const TOTAL_EMPLEADOS_DEMO = 1 + NOMBRES_ENCARGADOS.length + NOMBRES_TRABAJADORES.length

/** Convenio al que se asocia cada empleado. `null` deja el cómputo a factor 1. */
export function convenioDeEmpleadoDemo(indice: number): string | null {
  if (indice === 0) return 'OFICINA'
  if (indice <= NOMBRES_ENCARGADOS.length) return 'OFICINA'
  if (indice >= 40) return null
  if (indice % 3 === 0) return 'FORMACION'
  if (indice % 3 === 1) return 'OBRA'
  return 'OFICINA'
}

/* -------------------------------------------------------------------------- */
/* Riesgo presupuestario y plazo                                              */
/* -------------------------------------------------------------------------- */

const RANGO_RIESGO: Record<'OK' | 'AVISO' | 'CRITICO' | 'AGOTADO', number> = {
  OK: 0,
  AVISO: 1,
  CRITICO: 2,
  AGOTADO: 3,
}

const FACTOR_CONSUMO: Record<'OK' | 'AVISO' | 'CRITICO' | 'AGOTADO', number> = {
  OK: 0.6,
  AVISO: 0.8,
  CRITICO: 0.93,
  AGOTADO: 1.11,
}

export type PlanProyecto = {
  horasPresupuesto: number | null
  fechaInicio: FechaIso | null
  fechaFin: FechaIso | null
}

/**
 * Calcula horas y plazo para que `evaluarRiesgo` devuelva el nivel pedido.
 * El ajuste se verifica con la propia función del dominio y se corrige en
 * pasos de una hora si el redondeo lo deja en otro nivel.
 */
export function planDeRiesgo(
  nivel: NivelRiesgo,
  minutosConsumidos: number,
  hoy: FechaIso,
): PlanProyecto {
  const fechaInicio = sumarDias(hoy, -57)
  const fechaFin = sumarDias(hoy, 26)

  if (nivel === 'SIN_PRESUPUESTO') {
    return { horasPresupuesto: null, fechaInicio, fechaFin }
  }

  const objetivo = nivel === 'SIN_PLAZO' ? 'OK' : nivel
  if (minutosConsumidos === 0 && objetivo === 'OK') {
    // Proyecto sin consumo (por ejemplo, inactivo): un presupuesto de una hora
    // para cuadrar el 0 % de consumo no es verosímil.
    return { horasPresupuesto: 1_800, fechaInicio, fechaFin }
  }
  let horas = Math.max(1, Math.round(minutosConsumidos / 60 / FACTOR_CONSUMO[objetivo]))
  const plazo = nivel === 'SIN_PLAZO' ? { inicio: null, fin: null } : { inicio: fechaInicio, fin: fechaFin }

  for (let intento = 0; intento < 60; intento += 1) {
    const riesgo = evaluarRiesgo({
      minutosConsumidos,
      horasPresupuesto: horas,
      fechaInicio: plazo.inicio,
      fechaFin: plazo.fin,
      hoy,
    })
    if (riesgo.nivel === objetivo) break
    const actual = RANGO_RIESGO[riesgo.nivel as keyof typeof RANGO_RIESGO] ?? 0
    horas = Math.max(1, horas + (actual > RANGO_RIESGO[objetivo] ? 1 : -1))
  }

  return { horasPresupuesto: horas, fechaInicio: plazo.inicio, fechaFin: plazo.fin }
}
