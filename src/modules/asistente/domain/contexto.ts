import { formatearHorasReloj } from '@/modules/partes/domain/horas'

/**
 * Contexto que se envía al proveedor de IA. Es deliberadamente pequeño: la IA
 * narra datos que la app ya calculó, nunca recibe la base de datos ni correos.
 * Todas las funciones son puras para poder comprobar qué se envía exactamente.
 */

export type PersonaBriefing = {
  estado: string
  minutos: number
  diasEspera: number
}

export type ProyectoBriefing = {
  codigo: string
  nombre: string
  nivel: string
  consumoPct: number | null
  desviacionPp: number | null
}

export type DatosBriefing = {
  semana: { isoYear: number; isoWeek: number; rango: string }
  totales: { minutos: number; partes: number; empleados: number; pendientes: number }
  cumplimiento: {
    pct: number
    sinParte: number
    borradores: number
    rechazados: number
    enviados: number
    aprobados: number
  }
  personas: (PersonaBriefing & { nombre: string })[]
  proyectos: ProyectoBriefing[]
}

export type LineaParte = {
  fecha: string
  proyecto: string
  tarea: string
  minutos: number
  nota: string | null
}

export type DatosParte = {
  empleado: string
  semana: { isoYear: number; isoWeek: number; rango: string }
  estado: string
  totalMinutos: number
  motivoPrevio: string | null
  lineas: LineaParte[]
}

export type OpcionesContexto = {
  /** Sustituye los nombres propios por inicial y apellido. */
  pseudonimizar: boolean
  maxPersonas?: number
  maxProyectos?: number
  maxLineas?: number
}

export type ContextoBriefing = {
  semana: string
  resumen: {
    horasImputadas: string
    partes: number
    empleados: number
    pendientesRevision: number
    cumplimientoPct: number
    sinParte: number
    borradores: number
    rechazados: number
    enviados: number
    aprobados: number
  }
  personasQueRequierenAccion: {
    nombre: string
    estado: string
    diasEspera: number
    horas: string
  }[]
  proyectos: {
    codigo: string
    nombre: string
    nivel: string
    consumoPct: number | null
    desviacionPp: number | null
  }[]
}

export type ContextoParte = {
  empleado: string
  semana: string
  estado: string
  totalHoras: string
  motivoAnterior: string | null
  lineas: {
    fecha: string
    proyecto: string
    tarea: string
    horas: string
    nota: string | null
  }[]
}

const MAX_TEXTO = 120
const MAX_NOMBRE = 80

/** Urgencia para el encargado: primero lo que bloquea el cierre. */
const PRIORIDAD_PERSONA: Record<string, number> = {
  RECHAZADO: 0,
  SIN_PARTE: 1,
  BORRADOR: 2,
  ENVIADO: 3,
  APROBADO: 4,
  BLOQUEADO: 5,
}

const PRIORIDAD_RIESGO: Record<string, number> = {
  AGOTADO: 0,
  CRITICO: 1,
  AVISO: 2,
  OK: 3,
  SIN_PRESUPUESTO: 4,
  SIN_PLAZO: 5,
}

/**
 * Normaliza un texto libre antes de enviarlo. Elimina caracteres de control y
 * los delimitadores del bloque de datos, colapsa espacios y trunca. Así un
 * nombre de proyecto o una nota no puede romper el marcado del prompt.
 */
export function limpiarTexto(texto: string, maximo = MAX_TEXTO): string {
  const limpio = texto
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (limpio.length <= maximo) return limpio
  return `${limpio.slice(0, Math.max(0, maximo - 1)).trimEnd()}…`
}

/** `José Antonio Ruiz López` -> `J. López`. Sin nombre, devuelve `Empleado`. */
export function pseudonimizarNombre(nombre: string): string {
  const partes = limpiarTexto(nombre, MAX_NOMBRE).split(' ').filter(Boolean)
  const primero = partes[0]
  if (!primero) return 'Empleado'
  if (partes.length === 1) return primero
  const apellido = partes[partes.length - 1] ?? primero
  return `${primero.slice(0, 1).toUpperCase()}. ${apellido}`
}

function etiquetaSemana(semana: { isoYear: number; isoWeek: number; rango: string }): string {
  return `${semana.isoYear}-W${String(semana.isoWeek).padStart(2, '0')} (${semana.rango})`
}

function porUrgencia<T>(elemento: T, prioridades: Record<string, number>, nivel: (valor: T) => string): number {
  return prioridades[nivel(elemento)] ?? Number.MAX_SAFE_INTEGER
}

export function construirContextoBriefing(
  datos: DatosBriefing,
  opciones: OpcionesContexto,
): ContextoBriefing {
  const maxPersonas = opciones.maxPersonas ?? 10
  const maxProyectos = opciones.maxProyectos ?? 5

  const personas = [...datos.personas]
    .sort((a, b) => {
      const urgencia = porUrgencia(a, PRIORIDAD_PERSONA, (p) => p.estado)
      const otra = porUrgencia(b, PRIORIDAD_PERSONA, (p) => p.estado)
      if (urgencia !== otra) return urgencia - otra
      return b.diasEspera - a.diasEspera
    })
    .slice(0, maxPersonas)
    .map((persona) => ({
      nombre: opciones.pseudonimizar
        ? pseudonimizarNombre(persona.nombre)
        : limpiarTexto(persona.nombre, MAX_NOMBRE),
      estado: limpiarTexto(persona.estado, 40),
      diasEspera: persona.diasEspera,
      horas: formatearHorasReloj(persona.minutos),
    }))

  const proyectos = [...datos.proyectos]
    .sort((a, b) => {
      const urgencia = porUrgencia(a, PRIORIDAD_RIESGO, (p) => p.nivel)
      const otra = porUrgencia(b, PRIORIDAD_RIESGO, (p) => p.nivel)
      if (urgencia !== otra) return urgencia - otra
      return (b.consumoPct ?? 0) - (a.consumoPct ?? 0)
    })
    .slice(0, maxProyectos)
    .map((proyecto) => ({
      codigo: limpiarTexto(proyecto.codigo, 40),
      nombre: limpiarTexto(proyecto.nombre, MAX_NOMBRE),
      nivel: limpiarTexto(proyecto.nivel, 40),
      consumoPct: proyecto.consumoPct,
      desviacionPp: proyecto.desviacionPp,
    }))

  return {
    semana: etiquetaSemana(datos.semana),
    resumen: {
      horasImputadas: formatearHorasReloj(datos.totales.minutos),
      partes: datos.totales.partes,
      empleados: datos.totales.empleados,
      pendientesRevision: datos.totales.pendientes,
      cumplimientoPct: datos.cumplimiento.pct,
      sinParte: datos.cumplimiento.sinParte,
      borradores: datos.cumplimiento.borradores,
      rechazados: datos.cumplimiento.rechazados,
      enviados: datos.cumplimiento.enviados,
      aprobados: datos.cumplimiento.aprobados,
    },
    personasQueRequierenAccion: personas,
    proyectos,
  }
}

export function construirContextoParte(
  datos: DatosParte,
  opciones: OpcionesContexto,
): ContextoParte {
  const maxLineas = opciones.maxLineas ?? 40

  return {
    empleado: opciones.pseudonimizar
      ? pseudonimizarNombre(datos.empleado)
      : limpiarTexto(datos.empleado, MAX_NOMBRE),
    semana: etiquetaSemana(datos.semana),
    estado: limpiarTexto(datos.estado, 40),
    totalHoras: formatearHorasReloj(datos.totalMinutos),
    motivoAnterior: datos.motivoPrevio ? limpiarTexto(datos.motivoPrevio) : null,
    lineas: datos.lineas.slice(0, maxLineas).map((linea) => ({
      fecha: limpiarTexto(linea.fecha, 20),
      proyecto: limpiarTexto(linea.proyecto, MAX_NOMBRE),
      tarea: limpiarTexto(linea.tarea, MAX_NOMBRE),
      horas: formatearHorasReloj(linea.minutos),
      nota: linea.nota ? limpiarTexto(linea.nota) : null,
    })),
  }
}
