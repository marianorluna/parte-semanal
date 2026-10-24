import {
  calcularLinea,
  costeDeMinutos,
  ejecucionPresupuesto,
  eurosACentimos,
  formatearEuros,
  presupuestoVigente,
  sumarImportes,
  tarifaAplicable,
  validarTarifa,
  vigenciasSolapadas,
  type TarifaCoste,
} from './coste'

function tarifa(parcial: Partial<TarifaCoste> & { id: string; desde: string }): TarifaCoste {
  return {
    empleadoId: 'e1',
    categoria: null,
    importeHoraCents: 2_000,
    hasta: null,
    activo: true,
    ...parcial,
  }
}

describe('costeDeMinutos', () => {
  it('calcula en céntimos enteros y redondea una sola vez', () => {
    expect(costeDeMinutos(60, 2_500)).toBe(2_500)
    expect(costeDeMinutos(30, 2_500)).toBe(1_250)
    expect(costeDeMinutos(90, 1_999)).toBe(2_999)
    expect(costeDeMinutos(1, 1_000)).toBe(17)
  })

  it('devuelve 0 para minutos o tarifas no positivas', () => {
    expect(costeDeMinutos(0, 2_000)).toBe(0)
    expect(costeDeMinutos(-30, 2_000)).toBe(0)
    expect(costeDeMinutos(60, 0)).toBe(0)
  })
})

describe('tarifaAplicable', () => {
  it('elige la tarifa vigente a la fecha, no la más reciente', () => {
    const tarifas = [
      tarifa({ id: 'vieja', desde: '2026-01-01', hasta: '2026-06-30', importeHoraCents: 1_800 }),
      tarifa({ id: 'nueva', desde: '2026-07-01', importeHoraCents: 2_000 }),
    ]

    expect(tarifaAplicable(tarifas, '2026-03-15', { empleadoId: 'e1', categoria: null })?.id).toBe('vieja')
    expect(tarifaAplicable(tarifas, '2026-07-01', { empleadoId: 'e1', categoria: null })?.id).toBe('nueva')
  })

  it('aplica un cambio de tarifa a mitad de semana solo a los días posteriores', () => {
    const tarifas = [
      tarifa({ id: 'antigua', desde: '2026-01-01', hasta: '2026-10-21', importeHoraCents: 1_500 }),
      tarifa({ id: 'actual', desde: '2026-10-22', importeHoraCents: 1_800 }),
    ]

    const lunes = calcularLinea({ fecha: '2026-10-19', minutos: 480 }, tarifas, {
      empleadoId: 'e1',
      categoria: null,
    })
    const jueves = calcularLinea({ fecha: '2026-10-22', minutos: 480 }, tarifas, {
      empleadoId: 'e1',
      categoria: null,
    })

    expect(lunes.importeCents).toBe(12_000)
    expect(jueves.importeCents).toBe(14_400)
  })

  it('prioriza la tarifa de empleado sobre la de categoría', () => {
    const tarifas = [
      tarifa({ id: 'categoria', desde: '2026-01-01', empleadoId: null, categoria: 'Oficial 1ª', importeHoraCents: 1_600 }),
      tarifa({ id: 'empleado', desde: '2026-01-01', importeHoraCents: 2_100 }),
    ]

    const elegida = tarifaAplicable(tarifas, '2026-05-01', { empleadoId: 'e1', categoria: 'Oficial 1ª' })
    expect(elegida?.id).toBe('empleado')
  })

  it('cae a la categoría cuando no hay tarifa de empleado', () => {
    const tarifas = [
      tarifa({ id: 'categoria', desde: '2026-01-01', empleadoId: null, categoria: 'Peón', importeHoraCents: 1_400 }),
    ]

    const elegida = tarifaAplicable(tarifas, '2026-05-01', { empleadoId: 'e1', categoria: 'Peón' })
    expect(elegida?.id).toBe('categoria')
  })

  it('ignora tarifas inactivas y devuelve aviso sin tarifa', () => {
    const tarifas = [tarifa({ id: 'inactiva', desde: '2026-01-01', activo: false })]

    const calculada = calcularLinea({ fecha: '2026-05-01', minutos: 480 }, tarifas, {
      empleadoId: 'e1',
      categoria: null,
    })

    expect(calculada).toEqual({
      importeCents: 0,
      costeHoraCents: null,
      tarifaId: null,
      sinTarifa: true,
    })
  })
})

describe('vigenciasSolapadas', () => {
  it('detecta solapes y permite tramos consecutivos', () => {
    expect(
      vigenciasSolapadas(
        { desde: '2026-01-01', hasta: '2026-06-30' },
        { desde: '2026-06-30', hasta: null },
      ),
    ).toBe(true)

    expect(
      vigenciasSolapadas(
        { desde: '2026-01-01', hasta: '2026-05-31' },
        { desde: '2026-06-01', hasta: '2026-12-31' },
      ),
    ).toBe(false)
  })

  it('rechaza rangos inválidos en la validación', () => {
    const error = validarTarifa({
      empleadoId: null,
      categoria: null,
      importeHoraCents: 1_500,
      desde: '2026-06-01',
      hasta: '2026-05-01',
    })
    expect(error?.campo).toBe('ambito')
  })
})

describe('presupuesto', () => {
  it('elige la versión más alta y calcula la ejecución', () => {
    const vigente = presupuestoVigente([
      { id: 'v1', version: 1, importeCents: 10_000_00, horasPresupuesto: 1_000 },
      { id: 'v2', version: 2, importeCents: 12_500_00, horasPresupuesto: 1_200 },
      { id: 'v3', version: 3, importeCents: 15_000_00, horasPresupuesto: 1_400 },
    ])

    expect(vigente?.version).toBe(3)
    expect(ejecucionPresupuesto(3_000_00, 12_000_00)).toEqual({
      presupuestoCents: 12_000_00,
      gastadoCents: 3_000_00,
      restanteCents: 9_000_00,
      porcentaje: 25,
      excedido: false,
    })
    expect(ejecucionPresupuesto(13_000_00, 12_000_00).excedido).toBe(true)
  })

  it('sin presupuesto no divide por cero', () => {
    expect(presupuestoVigente([])).toBeNull()
    expect(ejecucionPresupuesto(500, 0).porcentaje).toBe(0)
    expect(ejecucionPresupuesto(500, 0).excedido).toBe(false)
  })
})

describe('formato de importes', () => {
  it('suma céntimos y formatea con separadores españoles', () => {
    expect(sumarImportes([1_234, 5_678, 10])).toBe(6_922)
    expect(formatearEuros(123_456)).toBe('1.234,56 €')
    expect(formatearEuros(-5)).toBe('-0,05 €')
    expect(formatearEuros(0)).toBe('0,00 €')
  })

  it('convierte euros del formulario a céntimos', () => {
    expect(eurosACentimos('18,50')).toBe(1_850)
    expect(eurosACentimos('1.234,56')).toBe(123_456)
    expect(eurosACentimos('')).toBeNull()
    expect(eurosACentimos('-3')).toBeNull()
  })
})
