/**
 * Modelo de la navegación principal: enlaces sueltos o grupos desplegables.
 * Puro y sin dependencias de React para poder probarlo sin DOM.
 */

export type EnlaceNav = {
  href: string
  etiqueta: string
  /** Texto corto que explica el contenido del enlace dentro de un desplegable. */
  descripcion?: string
  contador?: number
}

export type GrupoNav = {
  etiqueta: string
  enlaces: EnlaceNav[]
}

export type ItemNav = EnlaceNav | GrupoNav

export function esGrupo(item: ItemNav): item is GrupoNav {
  return 'enlaces' in item
}

/**
 * Activo por ruta exacta o por subruta. El separador evita que
 * `/admin/usuarios` active `/admin/usuarios-archivados`.
 */
export function estaActivo(ruta: string, href: string): boolean {
  return ruta === href || ruta.startsWith(`${href}/`)
}

export function grupoActivo(ruta: string, grupo: GrupoNav): boolean {
  return grupo.enlaces.some((enlace) => estaActivo(ruta, enlace.href))
}

/** Suma de contadores del grupo; un enlace conserva el suyo. */
export function contadorVisible(item: ItemNav): number | undefined {
  if (!esGrupo(item)) return item.contador

  const total = item.enlaces.reduce((suma, enlace) => suma + (enlace.contador ?? 0), 0)
  return total > 0 ? total : undefined
}
