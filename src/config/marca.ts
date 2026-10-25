/**
 * Identidad de la aplicación. El nombre visible se compone de dos partes para
 * poder aplicar un color distinto a cada una; los textos planos (metadatos,
 * correos y exportaciones) usan `nombre` o `nombreMayusculas`.
 *
 * `nombre` va en camel case a propósito: en contextos sin color (título de la
 * pestaña, asunto de un correo, propiedades de un PDF) es lo único que separa
 * las dos palabras de la fórmula `LEVI` + `ALGO`.
 */
export const MARCA = {
  prefijo: 'LEVI',
  sufijo: 'PARTE',
  nombre: 'LeviParte',
  nombreMayusculas: 'LEVIPARTE',
} as const
