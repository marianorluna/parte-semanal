import {
  computarSemana,
  formatearFactor,
  minutosConFactor,
  reglaAplicable,
  resumir,
  validarRegla,
  type LineaEntrada,
  type ReglaComputo,
} from './reglas'

function regla(parcial: Partial<ReglaComputo> & { id: string }): ReglaComputo {
  return {
    tipoHora: 'NORMAL',
    factorBps: 10_000,
    aplicaEn: 'TODO',
    topeDiarioMin: null,
    topeSemanalMin: null,
    requiereAutorizacion: false,
    prioridad: 100,
    activo: true,
    ...parcial,
  }
}

function linea(parcial: Partial<LineaEntrada> & { imputacionId: string }): LineaEntrada {
  return { fecha: '2026-03-02', minutos: 480, esFestivo: false, ...parcial }
}

describe('sin convenio configurado', () => {
  it('aplica factor 1 y mantiene los minutos intactos', () => {
    const tramos = computarSemana([linea({ imputacionId: 'a' })], [])
    expect(tramos).toHaveLength(1)
    expect(tramos[0]).toMatchObject({
      tipoHora: 'NORMAL',
      factorBps: 10_000,
      minutosBase: 480,
      minutosComputados: 480,
      reglaId: null,
    })
  })
})

describe('selección de regla', () => {
  it('el contexto festivo gana al comodín aunque tenga peor prioridad', () => {
    const comodin = regla({ id: 'todo', tipoHora: 'EXTRA', factorBps: 20_000, prioridad: 1 })
    const festiva = regla({
      id: 'festiva',
      tipoHora: 'FESTIVA',
      factorBps: 17_500,
      aplicaEn: 'FESTIVO',
      prioridad: 500,
    })

    expect(reglaAplicable([comodin, festiva], true)?.id).toBe('festiva')
    expect(reglaAplicable([comodin, festiva], false)?.id).toBe('todo')
  })

  it('dentro del mismo contexto gana la prioridad menor', () => {
    const normal = regla({ id: 'normal', tipoHora: 'NORMAL', aplicaEn: 'LABORABLE', prioridad: 200 })
    const extra = regla({ id: 'extra', tipoHora: 'EXTRA', aplicaEn: 'LABORABLE', prioridad: 100 })

    expect(reglaAplicable([normal, extra], false)?.id).toBe('extra')
  })

  it('ignora las reglas inactivas', () => {
    const inactiva = regla({ id: 'inactiva', tipoHora: 'FESTIVA', aplicaEn: 'FESTIVO', activo: false })
    expect(reglaAplicable([inactiva], true)).toBeNull()
  })
})

describe('factor y redondeo', () => {
  it('un festivo a 1,5 computa 720 minutos por 480 base', () => {
    const reglas = [regla({ id: 'festiva', tipoHora: 'FESTIVA', aplicaEn: 'FESTIVO', factorBps: 15_000 })]
    const [tramo] = computarSemana([linea({ imputacionId: 'a', esFestivo: true })], reglas)

    expect(tramo).toMatchObject({ tipoHora: 'FESTIVA', minutosBase: 480, minutosComputados: 720 })
  })

  it('redondea al minuto sin usar decimales', () => {
    expect(minutosConFactor(7, 17_500)).toBe(12)
    expect(Number.isInteger(minutosConFactor(1, 12_345))).toBe(true)
    expect(formatearFactor(17_500)).toBe('1,75')
  })
})

describe('topes', () => {
  it('el exceso del tope diario no multiplica', () => {
    const reglas = [
      regla({ id: 'extra', tipoHora: 'EXTRA', factorBps: 15_000, topeDiarioMin: 480 }),
    ]

    const tramos = computarSemana([linea({ imputacionId: 'a', minutos: 600 })], reglas)
    expect(tramos).toHaveLength(2)
    expect(tramos[0]).toMatchObject({ tipoHora: 'EXTRA', minutosBase: 480, minutosComputados: 720 })
    expect(tramos[1]).toMatchObject({
      tramo: 1,
      tipoHora: 'NORMAL',
      minutosBase: 120,
      minutosComputados: 120,
      reglaId: null,
    })
  })

  it('el tope diario se reparte entre varias imputaciones del mismo día', () => {
    const reglas = [regla({ id: 'extra', tipoHora: 'EXTRA', factorBps: 20_000, topeDiarioMin: 480 })]

    const tramos = computarSemana(
      [
        linea({ imputacionId: 'a', minutos: 300 }),
        linea({ imputacionId: 'b', minutos: 300 }),
      ],
      reglas,
    )

    const totalBase = tramos.reduce((suma, tramo) => suma + tramo.minutosBase, 0)
    const totalComputado = tramos.reduce((suma, tramo) => suma + tramo.minutosComputados, 0)
    expect(totalBase).toBe(600)
    // 480 x 2 + 120 x 1
    expect(totalComputado).toBe(1080)
  })

  it('el tope semanal se agota entre días', () => {
    const reglas = [regla({ id: 'extra', tipoHora: 'EXTRA', factorBps: 15_000, topeSemanalMin: 600 })]

    const tramos = computarSemana(
      [
        linea({ imputacionId: 'a', fecha: '2026-03-02', minutos: 480 }),
        linea({ imputacionId: 'b', fecha: '2026-03-03', minutos: 480 }),
      ],
      reglas,
    )

    const resumen = resumir(tramos)
    expect(resumen.minutosBase).toBe(960)
    expect(resumen.minutosComputados).toBe(1260)
    expect(resumen.porTipo.EXTRA).toBe(600)
    expect(resumen.porTipo.NORMAL).toBe(360)
  })

  it('un tope de cero minutos disponibles deja todo a factor 1', () => {
    const reglas = [
      regla({ id: 'extra', tipoHora: 'EXTRA', factorBps: 15_000, topeDiarioMin: 480 }),
    ]

    const tramos = computarSemana(
      [
        linea({ imputacionId: 'a', minutos: 480 }),
        linea({ imputacionId: 'b', minutos: 60 }),
      ],
      reglas,
    )

    expect(tramos.at(-1)).toMatchObject({ tipoHora: 'NORMAL', minutosBase: 60, minutosComputados: 60 })
  })
})

describe('autorización previa', () => {
  it('marca el resumen cuando alguna regla la exige', () => {
    const reglas = [
      regla({ id: 'extra', tipoHora: 'EXTRA', factorBps: 15_000, requiereAutorizacion: true }),
    ]
    const resumen = resumir(computarSemana([linea({ imputacionId: 'a' })], reglas))
    expect(resumen.requiereAutorizacion).toBe(true)
  })
})

describe('entradas inválidas', () => {
  it('ignora minutos cero o negativos en lugar de inventar tramos', () => {
    const tramos = computarSemana(
      [
        linea({ imputacionId: 'a', minutos: 0 }),
        linea({ imputacionId: 'b', minutos: -30 }),
      ],
      [],
    )
    expect(tramos).toEqual([])
  })
})

describe('validación de reglas', () => {
  it('rechaza factores fuera de rango y topes imposibles', () => {
    expect(validarRegla({ factorBps: 10_000, topeDiarioMin: null, topeSemanalMin: null, prioridad: 100 })).toBeNull()
    expect(validarRegla({ factorBps: -1, topeDiarioMin: null, topeSemanalMin: null, prioridad: 100 })?.campo).toBe('factor')
    expect(
      validarRegla({ factorBps: 10_000, topeDiarioMin: 0, topeSemanalMin: null, prioridad: 100 })?.campo,
    ).toBe('topeDiario')
    expect(
      validarRegla({ factorBps: 10_000, topeDiarioMin: null, topeSemanalMin: 20_000, prioridad: 100 })?.campo,
    ).toBe('topeSemanal')
  })
})
