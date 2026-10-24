/**
 * Reglas puras de la API pública: formato de claves, alcances, vigencia y
 * ventanas de rate limit. Sin acceso a base de datos ni a red.
 */

export const ALCANCES = ['partes:leer', 'proyectos:leer', 'imputaciones:escribir'] as const
export type Alcance = (typeof ALCANCES)[number]

export const EVENTOS = [
  'parte.enviado',
  'parte.aprobado',
  'parte.rechazado',
  'parte.reabierto',
] as const
export type Evento = (typeof EVENTOS)[number]

/** 60 peticiones por clave y minuto: suficiente para integraciones por lotes. */
export const LIMITE_POR_MINUTO = 60

const PATRON_CLAVE = /^lv_([a-f0-9]{12})_([a-f0-9]{40})$/

export function esAlcance(valor: string): valor is Alcance {
  return (ALCANCES as readonly string[]).includes(valor)
}

export function esEvento(valor: string): valor is Evento {
  return (EVENTOS as readonly string[]).includes(valor)
}

/** Deduplica conservando el orden y descarta alcances desconocidos. */
export function normalizarAlcances(valores: readonly string[]): Alcance[] {
  const vistos = new Set<Alcance>()
  for (const valor of valores) {
    if (esAlcance(valor)) vistos.add(valor)
  }
  return [...vistos]
}

export function normalizarEventos(valores: readonly string[]): Evento[] {
  const vistos = new Set<Evento>()
  for (const valor of valores) {
    if (esEvento(valor)) vistos.add(valor)
  }
  return [...vistos]
}

export function formatearClave(prefijo: string, secreto: string): string {
  return `lv_${prefijo}_${secreto}`
}

export function extraerPrefijo(clave: string): string | null {
  return PATRON_CLAVE.exec(clave.trim())?.[1] ?? null
}

/** Una clave revocada o caducada no autentica, aunque el hash coincida. */
export function claveVigente(
  clave: { activo: boolean; caducaAt: Date | null },
  ahora: Date,
): boolean {
  if (!clave.activo) return false
  return clave.caducaAt === null || clave.caducaAt.getTime() > ahora.getTime()
}

export function tieneAlcance(alcances: readonly Alcance[], requerido: Alcance): boolean {
  return alcances.includes(requerido)
}

/** Inicio del minuto en UTC: la ventana del contador de rate limit. */
export function ventanaMinuto(ahora: Date): Date {
  const copia = new Date(ahora.getTime())
  copia.setUTCSeconds(0, 0)
  return copia
}

export function claveIdempotenciaValida(clave: string): boolean {
  return clave.trim().length >= 8 && clave.trim().length <= 128
}

export function urlWebhookValida(url: string, permitirHttp: boolean): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') return true
    return permitirHttp && parsed.protocol === 'http:'
  } catch {
    return false
  }
}
