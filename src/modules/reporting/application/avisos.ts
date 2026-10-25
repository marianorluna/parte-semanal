import type { ResumenRiesgo } from '../domain/riesgo'
import {
  peorSeveridad,
  severidadPendientesRevision,
  severidadProyectosEnRiesgo,
  severidadSinEnviar,
  type Severidad,
} from '../domain/severidad'

/**
 * Avisos accionables del panel de control. Se calculan una sola vez para que
 * la vista web y los informes exportados muestren exactamente los mismos
 * problemas. Función pura, sin acceso a datos.
 */
export type AvisoPanel = {
  texto: string
  href: string
  severidad: Severidad
}

export type AvisosPanel = {
  avisos: AvisoPanel[]
  severidad: Severidad
}

export type EntradaAvisos = {
  /** Partes enviados esperando revisión del encargado. */
  pendientesRevision: number
  /** Personas que todavía no han cargado ni corregido su parte. */
  personasSinEnviar: number
  riesgo: ResumenRiesgo
}

function plural(total: number, singular: string, plural_: string): string {
  return total === 1 ? singular : plural_
}

export function avisosDelPanel(entrada: EntradaAvisos): AvisosPanel {
  const avisos: AvisoPanel[] = []

  if (entrada.pendientesRevision > 0) {
    avisos.push({
      texto: `${entrada.pendientesRevision} ${plural(entrada.pendientesRevision, 'parte enviado', 'partes enviados')} sin revisar`,
      href: '/control/partes?estado=ENVIADO',
      severidad: severidadPendientesRevision(entrada.pendientesRevision),
    })
  }

  if (entrada.personasSinEnviar > 0) {
    avisos.push({
      texto: `${entrada.personasSinEnviar} ${plural(entrada.personasSinEnviar, 'persona', 'personas')} sin enviar horas`,
      href: '/control/equipo',
      severidad: severidadSinEnviar(entrada.personasSinEnviar),
    })
  }

  const proyectosEnRiesgo = entrada.riesgo.agotados + entrada.riesgo.criticos + entrada.riesgo.avisos
  if (proyectosEnRiesgo > 0) {
    const agotados =
      entrada.riesgo.agotados > 0
        ? ` (${entrada.riesgo.agotados} ${plural(entrada.riesgo.agotados, 'agotado', 'agotados')})`
        : ''
    avisos.push({
      texto: `${proyectosEnRiesgo} ${plural(proyectosEnRiesgo, 'proyecto', 'proyectos')} en riesgo${agotados}`,
      href: '/control/proyectos',
      severidad: severidadProyectosEnRiesgo(entrada.riesgo),
    })
  }

  const severidad = avisos.reduce<Severidad>((peor, aviso) => peorSeveridad(peor, aviso.severidad), 'OK')

  return { avisos, severidad }
}
