import { evaluarRiesgo, resumirRiesgos, ritmoAdmisible } from './riesgo'

const HOY = '2026-10-24'

describe('evaluarRiesgo', () => {
  it('marca sin presupuesto cuando no hay horas definidas', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 600,
      horasPresupuesto: null,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      hoy: HOY,
    })

    expect(riesgo.nivel).toBe('SIN_PRESUPUESTO')
    expect(riesgo.consumoPct).toBeNull()
    expect(riesgo.plazoPct).not.toBeNull()
  })

  it('marca sin plazo cuando faltan fechas', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 300 * 60,
      horasPresupuesto: 600,
      fechaInicio: null,
      fechaFin: null,
      hoy: HOY,
    })

    expect(riesgo.nivel).toBe('SIN_PLAZO')
    expect(riesgo.consumoPct).toBe(50)
    expect(riesgo.proyeccionPct).toBeNull()
  })

  it('detecta el caso 30% consumido con 10% de plazo como crítico', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 30 * 60,
      horasPresupuesto: 100,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      // 10 días de 365 transcurridos: 3% de plazo, con 30% de consumo.
      hoy: '2026-01-10',
    })

    expect(riesgo.consumoPct).toBe(30)
    expect(riesgo.desviacionPp).toBeGreaterThanOrEqual(20)
    expect(riesgo.nivel).toBe('CRITICO')
  })

  it('deja en ritmo un consumo coherente con el plazo', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 40 * 60,
      horasPresupuesto: 100,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      hoy: '2026-08-01',
    })

    expect(riesgo.consumoPct).toBe(40)
    expect(riesgo.plazoPct).toBeGreaterThanOrEqual(40)
    expect(riesgo.nivel).toBe('OK')
  })

  it('marca agotado al llegar al 100% del presupuesto', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 100 * 60,
      horasPresupuesto: 100,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      hoy: '2026-06-01',
    })

    expect(riesgo.nivel).toBe('AGOTADO')
    expect(riesgo.minutosRestantes).toBe(0)
  })

  it('entra en aviso con una desviación moderada', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 76 * 60,
      horasPresupuesto: 200,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      hoy: '2026-05-01',
    })

    expect(riesgo.nivel).toBe('AVISO')
  })

  it('no divide por cero cuando el proyecto empieza hoy', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 60,
      horasPresupuesto: 10,
      fechaInicio: HOY,
      fechaFin: '2026-12-31',
      hoy: HOY,
    })

    expect(riesgo.plazoPct).toBeGreaterThan(0)
    expect(riesgo.proyeccionPct).not.toBeNull()
  })

  it('trata como sin plazo un rango invertido', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 60,
      horasPresupuesto: 10,
      fechaInicio: '2026-12-31',
      fechaFin: '2026-01-01',
      hoy: HOY,
    })

    expect(riesgo.nivel).toBe('SIN_PLAZO')
  })

  it('ignora minutos negativos', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: -500,
      horasPresupuesto: 10,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      hoy: HOY,
    })

    expect(riesgo.consumoPct).toBe(0)
  })
})

describe('resumirRiesgos', () => {
  it('cuenta cada nivel y agrupa los estados sin datos', () => {
    const base = {
      minutosConsumidos: 0,
      horasPresupuesto: 100,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      hoy: HOY,
    }

    const resumen = resumirRiesgos([
      evaluarRiesgo({ ...base, minutosConsumidos: 100 * 60 }),
      evaluarRiesgo({ ...base, minutosConsumidos: 30 * 60, hoy: '2026-01-10' }),
      evaluarRiesgo({ ...base, minutosConsumidos: 76 * 60, horasPresupuesto: 200, hoy: '2026-05-01' }),
      evaluarRiesgo({ ...base, minutosConsumidos: 10 * 60 }),
      evaluarRiesgo({ ...base, horasPresupuesto: null }),
      evaluarRiesgo({ ...base, fechaInicio: null, fechaFin: null }),
    ])

    expect(resumen.total).toBe(6)
    expect(resumen.agotados).toBe(1)
    expect(resumen.criticos).toBe(1)
    expect(resumen.avisos).toBe(1)
    expect(resumen.ok).toBe(1)
    expect(resumen.sinDatos).toBe(2)
  })
})

describe('ritmoAdmisible', () => {
  it('reparte las horas restantes entre los días que quedan', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 48 * 60,
      horasPresupuesto: 120,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-30',
      hoy: '2026-01-16',
    })

    // 30 días de plazo, 16 transcurridos, 14 restantes y 72 h pendientes.
    expect(ritmoAdmisible(riesgo)).toBe(309)
  })

  it('devuelve null sin presupuesto', () => {
    const riesgo = evaluarRiesgo({
      minutosConsumidos: 0,
      horasPresupuesto: null,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      hoy: HOY,
    })

    expect(ritmoAdmisible(riesgo)).toBeNull()
  })
})
