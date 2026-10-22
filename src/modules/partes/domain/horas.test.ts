import { formatearHorasReloj, horasAMinutos, minutosAHorasDecimal } from './horas'

describe('horasAMinutos', () => {
  it('convierte decimales con coma y con punto', () => {
    expect(horasAMinutos('1,5')).toEqual({ ok: true, minutos: 90 })
    expect(horasAMinutos('1.5')).toEqual({ ok: true, minutos: 90 })
  })

  it('convierte formato reloj', () => {
    expect(horasAMinutos('7:30')).toEqual({ ok: true, minutos: 450 })
    expect(horasAMinutos('0:07')).toEqual({ ok: true, minutos: 7 })
  })

  it('trata el vacío como cero', () => {
    expect(horasAMinutos('')).toEqual({ ok: true, minutos: 0 })
    expect(horasAMinutos('   ')).toEqual({ ok: true, minutos: 0 })
  })

  it('rechaza negativos y texto', () => {
    expect(horasAMinutos('-1').ok).toBe(false)
    expect(horasAMinutos('dos horas').ok).toBe(false)
    expect(horasAMinutos('1:99').ok).toBe(false)
  })

  it('redondea fracciones al minuto', () => {
    expect(horasAMinutos('0,25')).toEqual({ ok: true, minutos: 15 })
  })
})

describe('formato de salida', () => {
  it('muestra horas decimales con coma', () => {
    expect(minutosAHorasDecimal(450)).toBe('7,50')
    expect(minutosAHorasDecimal(90)).toBe('1,50')
  })

  it('muestra horas de reloj', () => {
    expect(formatearHorasReloj(450)).toBe('7:30')
    expect(formatearHorasReloj(7)).toBe('0:07')
    expect(formatearHorasReloj(0)).toBe('0:00')
  })
})
