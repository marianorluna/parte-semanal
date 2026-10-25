import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import { diasEntre, hoyEnZona, type FechaIso, type SemanaIso } from '@/modules/partes/domain/fechas'
import {
  evaluarRiesgo,
  resumirRiesgos,
  type ResumenRiesgo,
  type RiesgoProyecto,
} from '../domain/riesgo'
import {
  estadoCumplimiento,
  ordenarPorAtencion,
  requiereAccionDelTrabajador,
  resumirCumplimiento,
  type EstadoCumplimiento,
  type ResumenCumplimiento,
} from '../domain/cumplimiento'
import {
  consumoTotalPorProyecto,
  miembrosEquipo,
  partesDeEmpleados,
  type FilaConsumoProyecto,
} from '../infrastructure/consultas'

export type ProyectoConRiesgo = FilaConsumoProyecto & { riesgo: RiesgoProyecto }

export type PanelRiesgo = {
  filas: ProyectoConRiesgo[]
  resumen: ResumenRiesgo
  enAlerta: ProyectoConRiesgo[]
}

/**
 * Cruza consumo acumulado (sin borradores) con presupuesto y plazo. Es la
 * fuente única del semáforo en dashboard, listado y detalle de proyecto.
 */
export async function panelRiesgo(
  empresaId: string,
  permitidos: string[] | null,
  hoy: FechaIso,
): Promise<PanelRiesgo> {
  const proyectos = await consumoTotalPorProyecto(empresaId, permitidos)

  const filas = proyectos.map((proyecto) => ({
    ...proyecto,
    riesgo: evaluarRiesgo({
      minutosConsumidos: proyecto.minutos,
      horasPresupuesto: proyecto.horasPresupuesto,
      fechaInicio: proyecto.fechaInicio,
      fechaFin: proyecto.fechaFin,
      hoy,
    }),
  }))

  return {
    filas,
    resumen: resumirRiesgos(filas.map((fila) => fila.riesgo)),
    enAlerta: filas.filter(
      (fila) => fila.riesgo.nivel === 'AGOTADO' || fila.riesgo.nivel === 'CRITICO' || fila.riesgo.nivel === 'AVISO',
    ),
  }
}

export async function resumenCumplimientoDeSemana(
  usuario: UsuarioSesion,
  semana: SemanaIso,
): Promise<ResumenCumplimiento> {
  return (await detalleCumplimientoDeSemana(usuario, semana)).resumen
}

export type PersonaAtencion = {
  empleadoId: string
  usuarioId: string
  nombre: string
  estado: EstadoCumplimiento
  minutos: number
  /** Días desde que el parte debería estar cargado o corregido. */
  diasEspera: number
  motivo: string | null
}

export type DetalleCumplimiento = {
  resumen: ResumenCumplimiento
  /** Personas que dependen de un tercero o de sí mismas para cerrar la semana. */
  personas: PersonaAtencion[]
}

function fechaEnZona(valor: Date, zona: string): FechaIso {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(valor)
}

/**
 * Cumplimiento con nombre y apellidos. Reutiliza las mismas consultas que el
 * resto del panel para que el porcentaje del resumen y la lista de personas
 * nunca se contradigan.
 */
export async function detalleCumplimientoDeSemana(
  usuario: UsuarioSesion,
  semana: SemanaIso,
  hoy: FechaIso = hoyEnZona(process.env.TZ ?? 'Europe/Madrid'),
): Promise<DetalleCumplimiento> {
  const miembros = await miembrosEquipo(usuario.empresaId, semana, {
    encargadoUsuarioId: usuario.rol === 'ENCARGADO' ? usuario.id : null,
  })
  const partes = await partesDeEmpleados(
    miembros.map((miembro) => miembro.empleadoId),
    semana.isoYear,
    semana.isoWeek,
  )
  const partePorEmpleado = new Map(partes.map((parte) => [parte.empleadoId, parte]))

  const zona = process.env.TZ ?? 'Europe/Madrid'
  const hoySemana = Math.max(0, diasEntre(semana.weekStart, hoy))

  const entradas = miembros.map((miembro) => {
    const parte = partePorEmpleado.get(miembro.empleadoId)
    const estado = estadoCumplimiento({ estado: parte?.estado ?? null })

    const referencia =
      estado === 'RECHAZADO' && parte?.revisadoAt
        ? fechaEnZona(parte.revisadoAt, zona)
        : estado === 'ENVIADO' && parte?.enviadoAt
          ? fechaEnZona(parte.enviadoAt, zona)
          : null

    const desde = referencia ? Math.max(0, diasEntre(referencia, hoy)) : hoySemana

    return {
      empleadoId: miembro.empleadoId,
      usuarioId: miembro.usuarioId,
      nombre: miembro.nombre,
      estado,
      minutos: parte?.totalMinutos ?? 0,
      diasEspera: Math.min(desde, 365),
      motivo: parte?.motivoRechazo ?? null,
    }
  })

  const resumen = resumirCumplimiento(entradas.map((entrada) => ({ estado: entrada.estado })))

  const personas = ordenarPorAtencion(
    entradas.filter((entrada) => requiereAccionDelTrabajador(entrada.estado)),
  )

  return { resumen, personas }
}
