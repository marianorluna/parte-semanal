import { diasDeSemana, formatearFecha, inicioDeSemana, semanaIso, semanaIsoDe, sumarDias } from './fechas'

describe('semanas ISO', () => {
  it('calcula la semana del 1 de enero de 2026', () => {
    const semana = semanaIsoDe('2026-01-01')
    expect(semana.isoYear).toBe(2026)
    expect(semana.isoWeek).toBe(1)
    expect(semana.weekStart).toBe('2025-12-29')
    expect(semana.weekEnd).toBe('2026-01-04')
  })

  it('2026 tiene 53 semanas', () => {
    expect(semanaIsoDe('2026-12-31')).toMatchObject({ isoYear: 2026, isoWeek: 53 })
  })

  it('el 1 de enero de 2027 pertenece a la semana 53 de 2026', () => {
    expect(semanaIsoDe('2027-01-01')).toMatchObject({ isoYear: 2026, isoWeek: 53 })
  })

  it('el domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(semanaIsoDe('2026-10-25')).toMatchObject({ isoYear: 2026, isoWeek: 43, weekStart: '2026-10-19' })
  })

  it('construye la semana a partir del año y el número', () => {
    const semana = semanaIso(2026, 43)
    expect(semana.weekStart).toBe('2026-10-19')
    expect(semana.weekEnd).toBe('2026-10-25')
  })

  it('rechaza una semana inexistente', () => {
    expect(() => semanaIso(2025, 53)).toThrow()
    expect(() => semanaIso(2026, 54)).toThrow()
  })
})

describe('utilidades de fecha', () => {
  it('devuelve siete días de lunes a domingo', () => {
    const dias = diasDeSemana(2026, 43)
    expect(dias).toHaveLength(7)
    expect(dias[0]).toBe('2026-10-19')
    expect(dias[6]).toBe('2026-10-25')
  })

  it('el inicio de semana de un domingo es el lunes anterior', () => {
    expect(inicioDeSemana('2026-10-25')).toBe('2026-10-19')
  })

  it('suma días cruzando fin de año', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('formatea en español', () => {
    expect(formatearFecha('2026-10-19')).toBe('19/10/2026')
  })
})
