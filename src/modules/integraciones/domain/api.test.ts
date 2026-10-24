import {
  claveIdempotenciaValida,
  claveVigente,
  extraerPrefijo,
  formatearClave,
  normalizarAlcances,
  normalizarEventos,
  tieneAlcance,
  urlWebhookValida,
  ventanaMinuto,
} from './api'

const PREFIJO = 'abcdef123456'
const SECRETO = 'a'.repeat(40)

describe('claves de API', () => {
  it('extrae el prefijo de una clave con formato válido', () => {
    expect(extraerPrefijo(formatearClave(PREFIJO, SECRETO))).toBe(PREFIJO)
  })

  it('rechaza claves con formato incorrecto', () => {
    expect(extraerPrefijo('lv_corto_secreto')).toBeNull()
    expect(extraerPrefijo('otra_cosa')).toBeNull()
    expect(extraerPrefijo('')).toBeNull()
  })

  it('considera caducada una clave con fecha pasada', () => {
    const ahora = new Date('2026-10-24T10:00:00Z')
    expect(claveVigente({ activo: true, caducaAt: null }, ahora)).toBe(true)
    expect(
      claveVigente({ activo: true, caducaAt: new Date('2026-10-24T09:59:59Z') }, ahora),
    ).toBe(false)
    expect(
      claveVigente({ activo: false, caducaAt: new Date('2027-01-01T00:00:00Z') }, ahora),
    ).toBe(false)
  })
})

describe('alcances y eventos', () => {
  it('deduplica y descarta valores desconocidos', () => {
    expect(
      normalizarAlcances(['partes:leer', 'partes:leer', 'inventado', 'proyectos:leer']),
    ).toEqual(['partes:leer', 'proyectos:leer'])
  })

  it('mantiene solo eventos conocidos', () => {
    expect(normalizarEventos(['parte.aprobado', 'parte.aprobado', 'x'])).toEqual([
      'parte.aprobado',
    ])
  })

  it('comprueba el alcance requerido', () => {
    expect(tieneAlcance(['partes:leer'], 'partes:leer')).toBe(true)
    expect(tieneAlcance(['partes:leer'], 'imputaciones:escribir')).toBe(false)
  })
})

describe('ventana de rate limit', () => {
  it('trunca al inicio del minuto en UTC', () => {
    const ventana = ventanaMinuto(new Date('2026-10-24T10:03:45.678Z'))
    expect(ventana.toISOString()).toBe('2026-10-24T10:03:00.000Z')
  })
})

describe('validaciones de entrada', () => {
  it('exige una clave de idempotencia con longitud razonable', () => {
    expect(claveIdempotenciaValida('corta')).toBe(false)
    expect(claveIdempotenciaValida('idempotencia-123')).toBe(true)
    expect(claveIdempotenciaValida('x'.repeat(129))).toBe(false)
  })

  it('acepta https siempre y http solo si se permite', () => {
    expect(urlWebhookValida('https://ejemplo.com/hook', false)).toBe(true)
    expect(urlWebhookValida('http://ejemplo.com/hook', false)).toBe(false)
    expect(urlWebhookValida('http://localhost:3000/hook', true)).toBe(true)
    expect(urlWebhookValida('ftp://ejemplo.com', true)).toBe(false)
    expect(urlWebhookValida('no-es-url', true)).toBe(false)
  })
})
