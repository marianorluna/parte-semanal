export const DOMINIO_CORPORATIVO = '@levitec.es'

/** Partículas que no aportan al correo: "de la Fuente" -> "fuente". */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos'])

/** Minúsculas, sin diacríticos y solo letras: "Peña" -> "pena", "Álvaro" -> "alvaro". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

/**
 * Correo corporativo con el formato inicial del nombre más los apellidos:
 * "David Sierra" -> "dsierra@levitec.es"; "María de la Fuente" -> "mfuente@levitec.es".
 * Lanza si el nombre no permite construir un correo completo.
 */
export function emailCorporativo(nombreCompleto: string): string {
  const palabras = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  const nombre = palabras[0]
  if (!nombre) throw new Error('El nombre está vacío')

  const inicial = normalizar(nombre).charAt(0)
  const apellidos = palabras
    .slice(1)
    .filter((palabra) => !PARTICULAS.has(normalizar(palabra)))
    .map(normalizar)
    .join('')

  if (!inicial || !apellidos) {
    throw new Error(`No se puede construir el correo de "${nombreCompleto}": falta el apellido`)
  }

  return `${inicial}${apellidos}${DOMINIO_CORPORATIVO}`
}
