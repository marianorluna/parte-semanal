import {
  etiquetaPeriodo,
  fechasCubiertas,
  haySolape,
  motivoValido,
  rangoMes,
  rangoSemana,
  resolverPeriodo,
  solapaRango,
} from './cierre'

describe('rangoMes', () => {
  it('resuelve el último día de un mes de 31 días', () => {
    expect(rangoMes(2026, 10)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
  })

  it('resuelve febrero en año bisiesto y no bisiesto', () => {
    expect(rangoMes(2024, 2)).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' })
    expect(rangoMes(2026, 2)).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
  })

  it('rechaza meses fuera de rango', () => {
    expect(() => rangoMes(2026, 13)).toThrow()
    expect(() => rangoMes(2026, 0)).toThrow()
  })
})

describe('rangoSemana', () => {
  it('devuelve lunes a domingo', () => {
    expect(rangoSemana(2026, 44)).toEqual({ desde: '2026-10-26', hasta: '2026-11-01' })
  })

  it('una semana que cruza el mes conserva sus siete días', () => {
    const rango = rangoSemana(2026, 44)
    expect(rango.desde.slice(0, 7)).toBe('2026-10')
    expect(rango.hasta.slice(0, 7)).toBe('2026-11')
  })
})

describe('resolverPeriodo', () => {
  it('resuelve una semana de empresa sin empleado', () => {
    const resultado = resolverPeriodo(
      { tipo: 'SEMANAL', empleadoId: null, isoYear: 2026, isoWeek: 44 },
      'empresa-1',
    )
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.periodo).toMatchObject({
      desde: '2026-10-26',
      hasta: '2026-11-01',
      tipo: 'SEMANAL',
      empleadoId: null,
      anio: 2026,
      mes: null,
    })
  })

  it('rechaza una semana ISO inexistente', () => {
    // 2025 tiene 52 semanas: la 53 no existe.
    const resultado = resolverPeriodo(
      { tipo: 'SEMANAL', empleadoId: null, isoYear: 2025, isoWeek: 53 },
      'empresa-1',
    )
    expect(resultado.ok).toBe(false)
  })

  it('exige empleado en el cierre mensual', () => {
    const resultado = resolverPeriodo(
      { tipo: 'MENSUAL', empleadoId: null, anio: 2026, mes: 10 },
      'empresa-1',
    )
    expect(resultado).toMatchObject({ ok: false, campo: 'empleadoId' })
  })

  it('resuelve un mes por empleado', () => {
    const resultado = resolverPeriodo(
      { tipo: 'MENSUAL', empleadoId: 'empleado-1', anio: 2026, mes: 10 },
      'empresa-1',
    )
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.periodo).toMatchObject({
      desde: '2026-10-01',
      hasta: '2026-10-31',
      tipo: 'MENSUAL',
      isoYear: null,
      mes: 10,
    })
  })
})

describe('solapes', () => {
  it('detecta rangos que se tocan en un extremo', () => {
    expect(
      solapaRango({ desde: '2026-10-01', hasta: '2026-10-15' }, {
        desde: '2026-10-15',
        hasta: '2026-10-31',
      }),
    ).toBe(true)
  })

  it('no considera solape un rango posterior', () => {
    expect(
      solapaRango({ desde: '2026-10-01', hasta: '2026-10-31' }, {
        desde: '2026-11-01',
        hasta: '2026-11-30',
      }),
    ).toBe(false)
  })

  it('devuelve el primer periodo solapado', () => {
    const periodo = haySolape(
      [{ desde: '2026-10-01', hasta: '2026-10-31' }],
      { desde: '2026-10-26', hasta: '2026-11-01' },
    )
    expect(periodo).not.toBeNull()
  })
})

describe('fechasCubiertas', () => {
  it('devuelve solo las fechas cerradas dentro de la semana', () => {
    expect(
      fechasCubiertas(
        [{ desde: '2026-10-01', hasta: '2026-10-31' }],
        '2026-10-26',
        '2026-11-01',
      ),
    ).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ])
  })

  it('no duplica fechas cubiertas por varios periodos', () => {
    const fechas = fechasCubiertas(
      [
        { desde: '2026-10-01', hasta: '2026-10-31' },
        { desde: '2026-10-26', hasta: '2026-11-01' },
      ],
      '2026-10-26',
      '2026-11-01',
    )
    expect(fechas).toHaveLength(7)
  })

  it('sin periodos no bloquea ninguna fecha', () => {
    expect(fechasCubiertas([], '2026-10-26', '2026-11-01')).toEqual([])
  })
})

describe('etiquetaPeriodo y motivoValido', () => {
  it('etiqueta semana y mes', () => {
    expect(etiquetaPeriodo({ tipo: 'SEMANAL', isoYear: 2026, isoWeek: 44, anio: 2026, mes: null })).toBe(
      'Semana 44 de 2026',
    )
    expect(etiquetaPeriodo({ tipo: 'MENSUAL', isoYear: null, isoWeek: null, anio: 2026, mes: 2 })).toBe(
      'Mes 02/2026',
    )
  })

  it('exige un motivo con contenido suficiente', () => {
    expect(motivoValido('  ')).not.toBeNull()
    expect(motivoValido('Error de imputación')).toBeNull()
  })
})
