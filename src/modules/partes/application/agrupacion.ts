import type { SemanaIso } from '../domain/fechas'
import type { TareaAsignada } from './ports'

export type GrupoProyecto = {
  proyectoId: string
  proyectoCodigo: string
  proyectoNombre: string
  tareas: {
    tareaId: string
    tareaCodigo: string
    tareaNombre: string
  }[]
}

export function agruparTareas(tareas: readonly TareaAsignada[]): GrupoProyecto[] {
  const mapa = new Map<string, GrupoProyecto>()

  for (const tarea of tareas) {
    const grupo = mapa.get(tarea.proyectoId) ?? {
      proyectoId: tarea.proyectoId,
      proyectoCodigo: tarea.proyectoCodigo,
      proyectoNombre: tarea.proyectoNombre,
      tareas: [],
    }

    if (!grupo.tareas.some((t) => t.tareaId === tarea.tareaId)) {
      grupo.tareas.push({
        tareaId: tarea.tareaId,
        tareaCodigo: tarea.tareaCodigo,
        tareaNombre: tarea.tareaNombre,
      })
    }

    mapa.set(tarea.proyectoId, grupo)
  }

  return [...mapa.values()].sort((a, b) => a.proyectoCodigo.localeCompare(b.proyectoCodigo))
}

export type SemanaNavegacion = {
  actual: SemanaIso
  anterior: { isoYear: number; isoWeek: number }
  siguiente: { isoYear: number; isoWeek: number }
  esActual: boolean
}
