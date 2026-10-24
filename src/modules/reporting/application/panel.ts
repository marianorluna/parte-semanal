import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import type { FechaIso, SemanaIso } from '@/modules/partes/domain/fechas'
import {
  evaluarRiesgo,
  resumirRiesgos,
  type ResumenRiesgo,
  type RiesgoProyecto,
} from '../domain/riesgo'
import { resumirCumplimiento, type ResumenCumplimiento } from '../domain/cumplimiento'
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
  const miembros = await miembrosEquipo(usuario.empresaId, semana, {
    encargadoUsuarioId: usuario.rol === 'ENCARGADO' ? usuario.id : null,
  })
  const partes = await partesDeEmpleados(
    miembros.map((miembro) => miembro.empleadoId),
    semana.isoYear,
    semana.isoWeek,
  )
  const estadoPorEmpleado = new Map(partes.map((parte) => [parte.empleadoId, parte.estado]))

  return resumirCumplimiento(
    miembros.map((miembro) => ({ estado: estadoPorEmpleado.get(miembro.empleadoId) ?? null })),
  )
}
