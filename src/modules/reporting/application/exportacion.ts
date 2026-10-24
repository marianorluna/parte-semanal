import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import { proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import type { FechaIso, SemanaIso } from '@/modules/partes/domain/fechas'
import { diasEntre, sumarDias } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { etiquetaEstado } from '@/modules/partes/domain/parte'
import type { ParteDetalle } from '@/modules/partes/infrastructure/consultas-detalle'
import { panelRiesgo, resumenCumplimientoDeSemana } from './panel'
import {
  evolucionSemanal,
  lineasParaExportar,
  nombreEmpresa,
  resumenSemana,
  topEmpleados,
} from '../infrastructure/consultas'
import type { NivelRiesgo } from '../domain/riesgo'
import {
  etiquetaSemana,
  type DatosDashboardExport,
  type DatosParteExport,
  type DatosPartesExport,
  type ProyectoExport,
} from '../infrastructure/exportadores/comun'

const ORDEN_RIESGO: Record<NivelRiesgo, number> = {
  AGOTADO: 0,
  CRITICO: 1,
  AVISO: 2,
  SIN_PRESUPUESTO: 3,
  SIN_PLAZO: 4,
  OK: 5,
}

export type FiltrosExport = { estado?: string; proyectoId?: string }

export async function datosPartes(
  usuario: UsuarioSesion,
  semana: SemanaIso,
  filtros: FiltrosExport = {},
): Promise<DatosPartesExport> {
  const permitidos = await proyectosPermitidos(usuario)

  const [empresa, lineas] = await Promise.all([
    nombreEmpresa(usuario.empresaId),
    lineasParaExportar(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos, filtros),
  ])

  const empleados = new Set(lineas.map((linea) => linea.empleadoCodigo))
  const totalMinutos = lineas.reduce((suma, linea) => suma + linea.minutos, 0)

  return {
    empresa,
    semana,
    lineas,
    resumen: {
      totalMinutos,
      partes: empleados.size,
      empleados: empleados.size,
      lineas: lineas.length,
    },
  }
}

export async function datosDashboard(
  usuario: UsuarioSesion,
  semana: SemanaIso,
  hoy: FechaIso,
): Promise<DatosDashboardExport> {
  const permitidos = await proyectosPermitidos(usuario)
  const desde = sumarDias(semana.weekStart, -7 * 7)

  const [empresa, resumen, panel, cumplimiento, evolucion, top] = await Promise.all([
    nombreEmpresa(usuario.empresaId),
    resumenSemana(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos),
    panelRiesgo(usuario.empresaId, permitidos, hoy),
    resumenCumplimientoDeSemana(usuario, semana),
    evolucionSemanal(usuario.empresaId, desde, semana.weekEnd, permitidos),
    topEmpleados(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos, 5),
  ])

  const diasEspera = resumen.pendienteMasAntiguo
    ? Math.max(0, diasEntre(resumen.pendienteMasAntiguo.toISOString().slice(0, 10) as FechaIso, hoy))
    : 0
  const enRiesgo = panel.resumen.agotados + panel.resumen.criticos + panel.resumen.avisos

  const proyectos: ProyectoExport[] = panel.filas
    .map((fila) => ({
      codigo: fila.codigo,
      nombre: fila.nombre,
      horasPresupuesto: fila.horasPresupuesto,
      minutos: fila.minutos,
      consumoPct: fila.riesgo.consumoPct,
      plazoPct: fila.riesgo.plazoPct,
      desviacionPp: fila.riesgo.desviacionPp,
      proyeccionPct: fila.riesgo.proyeccionPct,
      nivel: fila.riesgo.nivel,
      etiqueta: fila.riesgo.etiqueta,
    }))
    .sort((a, b) => ORDEN_RIESGO[a.nivel] - ORDEN_RIESGO[b.nivel] || b.minutos - a.minutos)

  return {
    empresa,
    hoy,
    semanaEtiqueta: etiquetaSemana(semana),
    kpis: [
      { etiqueta: 'Horas imputadas', valor: formatearHorasReloj(resumen.totalMinutos), detalle: 'en la semana' },
      { etiqueta: 'Partes', valor: String(resumen.partes), detalle: `${resumen.empleados} empleados` },
      { etiqueta: 'Pendientes de revisión', valor: String(resumen.pendientes), detalle: 'partes enviados' },
      {
        etiqueta: 'Antigüedad máxima',
        valor: `${resumen.pendientes > 0 ? diasEspera : 0} d`,
        detalle: 'del parte más antiguo',
      },
      {
        etiqueta: 'Sin enviar',
        valor: String(cumplimiento.pendientesDelTrabajador),
        detalle: 'personas que deben cargar horas',
      },
      {
        etiqueta: 'Cumplimiento',
        valor: `${cumplimiento.cumplimientoPct}%`,
        detalle: 'partes enviados o aprobados',
      },
      {
        etiqueta: 'Proyectos en riesgo',
        valor: String(enRiesgo),
        detalle: `${panel.resumen.agotados} agotados · ${panel.resumen.criticos} críticos · ${panel.resumen.avisos} avisos`,
      },
      {
        etiqueta: 'Proyectos activos',
        valor: String(panel.filas.filter((fila) => fila.activo).length),
        detalle: `${panel.resumen.ok} en ritmo · ${panel.resumen.sinDatos} sin presupuesto o plazo`,
      },
    ],
    cumplimiento,
    proyectos,
    tendencia: evolucion.map((fila) => ({ isoWeek: fila.isoWeek, minutos: fila.minutos })),
    top: top.map((fila) => ({ nombre: fila.nombre, minutos: fila.minutos })),
  }
}

export function datosParte(empresa: string, parte: ParteDetalle): DatosParteExport {
  return {
    empresa,
    parte: {
      id: parte.id,
      isoYear: parte.isoYear,
      isoWeek: parte.isoWeek,
      weekStart: parte.weekStart,
      weekEnd: sumarDias(parte.weekStart as FechaIso, 6),
      estado: etiquetaEstado(parte.estado),
      totalMinutos: parte.totalMinutos,
      enviadoAt: parte.enviadoAt,
      revisadoAt: parte.revisadoAt,
      motivoRechazo: parte.motivoRechazo,
      revisorNombre: parte.revisorNombre,
      empleadoNombre: parte.empleadoNombre,
      empleadoCodigo: parte.empleadoCodigo,
      imputaciones: parte.imputaciones,
    },
  }
}
