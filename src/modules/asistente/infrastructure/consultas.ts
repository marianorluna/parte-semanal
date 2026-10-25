import { AppError } from '@/shared/errors'
import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import {
  formatearFecha,
  formatearRango,
  hoyEnZona,
  sumarDias,
  type SemanaIso,
} from '@/modules/partes/domain/fechas'
import { parteParaRevision, type DepsPartes } from '@/modules/partes/application/servicio'
import { obtenerParteDetalle } from '@/modules/partes/infrastructure/consultas-detalle'
import { detalleCumplimientoDeSemana, panelRiesgo } from '@/modules/reporting/application/panel'
import { resumenSemana } from '@/modules/reporting/infrastructure/consultas'
import type { ConsultasAsistente } from '../application/ports'
import type { DatosBriefing, DatosParte } from '../domain/contexto'

/**
 * Traduce los datos ya calculados por `reporting` y `partes` al contexto mínimo
 * del asistente. No añade consultas nuevas a la base de datos salvo la lectura
 * del detalle del parte, y siempre reutiliza la autorización de `partes`.
 */

export type DepsConsultasAsistente = {
  depsPartes: DepsPartes
  proyectosPermitidos: (usuario: UsuarioSesion) => Promise<string[] | null>
}

export function crearConsultasAsistente(deps: DepsConsultasAsistente): ConsultasAsistente {
  const zona = process.env.TZ ?? 'Europe/Madrid'

  return {
    async briefing(usuario: UsuarioSesion, semana: SemanaIso): Promise<DatosBriefing> {
      const hoy = hoyEnZona(zona)
      const permitidos = await deps.proyectosPermitidos(usuario)

      const [resumen, panel, cumplimiento] = await Promise.all([
        resumenSemana(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos),
        panelRiesgo(usuario.empresaId, permitidos, hoy),
        detalleCumplimientoDeSemana(usuario, semana, hoy),
      ])

      return {
        semana: {
          isoYear: semana.isoYear,
          isoWeek: semana.isoWeek,
          rango: formatearRango(semana.weekStart, semana.weekEnd),
        },
        totales: {
          minutos: resumen.totalMinutos,
          partes: resumen.partes,
          empleados: resumen.empleados,
          pendientes: resumen.pendientes,
        },
        cumplimiento: {
          pct: cumplimiento.resumen.cumplimientoPct,
          sinParte: cumplimiento.resumen.sinParte,
          borradores: cumplimiento.resumen.borradores,
          rechazados: cumplimiento.resumen.rechazados,
          enviados: cumplimiento.resumen.enviados,
          aprobados: cumplimiento.resumen.aprobados,
        },
        personas: cumplimiento.personas.map((persona) => ({
          nombre: persona.nombre,
          estado: persona.estado,
          minutos: persona.minutos,
          diasEspera: persona.diasEspera,
        })),
        proyectos: panel.filas.map((fila) => ({
          codigo: fila.codigo,
          nombre: fila.nombre,
          nivel: fila.riesgo.nivel,
          consumoPct: fila.riesgo.consumoPct,
          desviacionPp: fila.riesgo.desviacionPp,
        })),
      }
    },

    async parte(usuario: UsuarioSesion, parteId: string): Promise<DatosParte> {
      // Repite la comprobación de alcance de la página: una Server Action es un
      // endpoint público y no puede confiar en el contexto que envía el cliente.
      await parteParaRevision(deps.depsPartes, usuario, parteId)

      const detalle = await obtenerParteDetalle(parteId)
      if (!detalle) throw new AppError('NO_ENCONTRADO', 'El parte no existe')

      return {
        empleado: detalle.empleadoNombre,
        semana: {
          isoYear: detalle.isoYear,
          isoWeek: detalle.isoWeek,
          rango: formatearRango(detalle.weekStart, sumarDias(detalle.weekStart, 6)),
        },
        estado: detalle.estado,
        totalMinutos: detalle.totalMinutos,
        motivoPrevio: detalle.motivoRechazo,
        lineas: detalle.imputaciones.map((linea) => ({
          fecha: formatearFecha(linea.fecha),
          proyecto: `${linea.proyectoCodigo} ${linea.proyectoNombre}`,
          tarea: `${linea.tareaCodigo} ${linea.tareaNombre}`,
          minutos: linea.minutos,
          nota: linea.nota,
        })),
      }
    },
  }
}
