import {
  aplicarAusenciasADias,
  calcularSaldo,
  capacidadDeDias,
  consumoPorAnio,
  diasEntre,
  minutosEnDia,
  rangosSolapan,
  transicionValida,
  type AusenciaVigente,
  type DiaBase,
} from './ausencia'

function dia(fecha: string, parcial: Partial<DiaBase> = {}): DiaBase {
  return {
    fecha,
    laborable: true,
    motivo: null,
    horasTeoricasMin: 480,
    ...parcial,
  }
}

function ausencia(parcial: Partial<AusenciaVigente> & { id: string }): AusenciaVigente {
  return {
    empleadoId: 'emp-1',
    desde: '2026-08-03',
    hasta: '2026-08-07',
    minutos: null,
    estado: 'APROBADA',
    tipoId: 'tipo-1',
    tipoNombre: 'Vacaciones',
    ...parcial,
  }
}

describe('rangos', () => {
  it('lista los días con extremos incluidos', () => {
    expect(diasEntre('2026-08-03', '2026-08-05')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ])
  })

  it('cruza el cambio de mes y de año', () => {
    expect(diasEntre('2026-12-31', '2027-01-02')).toEqual(['2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('devuelve vacío si el rango está invertido', () => {
    expect(diasEntre('2026-08-10', '2026-08-01')).toEqual([])
  })

  it('detecta solapes reales y no los que solo se tocan fuera', () => {
    const a = { desde: '2026-08-03', hasta: '2026-08-07' }
    expect(rangosSolapan(a, { desde: '2026-08-07', hasta: '2026-08-08' })).toBe(true)
    expect(rangosSolapan(a, { desde: '2026-08-08', hasta: '2026-08-09' })).toBe(false)
    expect(rangosSolapan(a, { desde: '2026-08-01', hasta: '2026-08-03' })).toBe(true)
  })
})

describe('transiciones', () => {
  it('permite aprobar, rechazar o anular una solicitud', () => {
    expect(transicionValida('SOLICITADA', 'APROBADA')).toBe(true)
    expect(transicionValida('SOLICITADA', 'RECHAZADA')).toBe(true)
    expect(transicionValida('SOLICITADA', 'ANULADA')).toBe(true)
  })

  it('solo permite anular una ausencia aprobada', () => {
    expect(transicionValida('APROBADA', 'ANULADA')).toBe(true)
    expect(transicionValida('APROBADA', 'APROBADA')).toBe(false)
  })

  it('no resucita una ausencia rechazada o anulada', () => {
    expect(transicionValida('RECHAZADA', 'APROBADA')).toBe(false)
    expect(transicionValida('ANULADA', 'APROBADA')).toBe(false)
  })
})

describe('efecto en la rejilla', () => {
  it('una ausencia de jornada completa deshabilita el día con su motivo', () => {
    const dias = aplicarAusenciasADias([dia('2026-08-03')], [ausencia({ id: 'a' })])
    expect(dias[0]).toMatchObject({
      laborable: false,
      motivo: 'Vacaciones',
      horasTeoricasMin: 0,
      ausencia: { nombre: 'Vacaciones', minutos: null },
    })
  })

  it('una ausencia parcial mantiene el día laborable y reduce la capacidad', () => {
    const dias = aplicarAusenciasADias(
      [dia('2026-08-03')],
      [ausencia({ id: 'a', desde: '2026-08-03', hasta: '2026-08-03', minutos: 120 })],
    )
    expect(dias[0]).toMatchObject({ laborable: true, horasTeoricasMin: 360 })
    expect(dias[0]?.ausencia).toEqual({ id: 'a', nombre: 'Vacaciones', minutos: 120 })
  })

  it('solo afecta a los días que caen dentro del rango', () => {
    const dias = aplicarAusenciasADias(
      [dia('2026-08-02'), dia('2026-08-03'), dia('2026-08-08')],
      [ausencia({ id: 'a', desde: '2026-08-03', hasta: '2026-08-07' })],
    )
    expect(dias.map((d) => d.laborable)).toEqual([true, false, true])
  })

  it('no cambia los días sin ausencia', () => {
    const original = dia('2026-08-03', { motivo: 'Festivo: Prueba', laborable: false })
    const [resultado] = aplicarAusenciasADias([original], [])
    expect(resultado).toEqual({ ...original, ausencia: null })
  })

  it('un festivo con ausencia conserva el motivo del festivo y no consume capacidad', () => {
    const original = dia('2026-08-03', { motivo: 'Festivo: Prueba', laborable: false })
    const [resultado] = aplicarAusenciasADias([original], [ausencia({ id: 'a' })])
    expect(resultado).toMatchObject({
      laborable: false,
      motivo: 'Festivo: Prueba',
      horasTeoricasMin: 480,
      ausencia: { nombre: 'Vacaciones', minutos: null },
    })
  })

  it('sin jornada teórica definida no inventa capacidad', () => {
    const dias = aplicarAusenciasADias(
      [dia('2026-08-03', { horasTeoricasMin: null })],
      [ausencia({ id: 'a', desde: '2026-08-03', hasta: '2026-08-03', minutos: 60 })],
    )
    expect(dias[0]?.horasTeoricasMin).toBeNull()
    expect(capacidadDeDias(dias)).toBeNull()
  })
})

describe('saldo de vacaciones', () => {
  it('resta el consumo del año sin contar lo que no consume', () => {
    const resumen = calcularSaldo(
      { minutosAsignados: 22 * 480, minutosArrastrados: 480 },
      { 2026: 3 * 480 },
      2026,
    )
    expect(resumen.disponibles).toBe(23 * 480)
    expect(resumen.consumidos).toBe(3 * 480)
    expect(resumen.restantes).toBe(20 * 480)
  })

  it('nunca devuelve saldo negativo', () => {
    const resumen = calcularSaldo({ minutosAsignados: 480, minutosArrastrados: 0 }, { 2026: 960 }, 2026)
    expect(resumen.restantes).toBe(0)
  })

  it('una jornada completa consume la capacidad del día', () => {
    expect(minutosEnDia({ minutos: null }, 480)).toBe(480)
    expect(minutosEnDia({ minutos: 120 }, 480)).toBe(120)
  })
})

describe('reparto del consumo por año', () => {
  const capacidad: Record<string, { laborable: boolean; horasTeoricasMin: number | null }> = {
    '2026-12-31': { laborable: true, horasTeoricasMin: 480 },
    '2027-01-01': { laborable: false, horasTeoricasMin: 480 },
    '2027-01-02': { laborable: true, horasTeoricasMin: 480 },
  }

  it('cruza el año y salta los festivos', () => {
    const consumo = consumoPorAnio(
      { desde: '2026-12-31', hasta: '2027-01-02', minutos: null },
      capacidad,
    )
    expect(consumo).toEqual({ 2026: 480, 2027: 480 })
  })

  it('una ausencia parcial consume solo sus minutos y nunca más que la jornada', () => {
    const consumo = consumoPorAnio(
      { desde: '2026-12-31', hasta: '2026-12-31', minutos: 120 },
      capacidad,
    )
    expect(consumo).toEqual({ 2026: 120 })

    const excesiva = consumoPorAnio(
      { desde: '2026-12-31', hasta: '2026-12-31', minutos: 600 },
      capacidad,
    )
    expect(excesiva).toEqual({ 2026: 480 })
  })
})
