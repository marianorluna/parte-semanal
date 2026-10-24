import type { DepsPartes } from '@/modules/partes/application/servicio'
import { repositorioPartes } from '@/modules/partes/infrastructure/repositorio'
import { proyectosDeParte, proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import type { DepsAvisos } from '@/modules/notificaciones/application/servicio'
import { consultasAvisos } from '@/modules/notificaciones/infrastructure/consultas'
import { repositorioNotificaciones } from '@/modules/notificaciones/infrastructure/repositorio'

/**
 * Raíz de composición: une los puertos de la aplicación con los adaptadores
 * concretos. Las páginas y Server Actions solo ven los casos de uso.
 */
export const depsPartes: DepsPartes = {
  repo: repositorioPartes,
  proyectosPermitidos,
  proyectosDeParte,
}

export const depsAvisos: DepsAvisos = {
  repo: repositorioNotificaciones,
  consultas: consultasAvisos,
}

export { repositorioNotificaciones }
