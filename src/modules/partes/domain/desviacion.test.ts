import {
  describirDesviacion,
  evaluarDesviacion,
  requiereJustificacion,
  validarMotivoDesviacion,
} from './desviacion'

const MOTIVO_VALIDO = 'Trabajé el sábado para cerrar la entrega'

describe('evaluarDesviacion', () => {
  it('sin capacidad configurada no hay juicio posible', () => {
    const desviacion = evaluarDesviacion(2400, null)
    expect(desviacion).toEqual({ capacidadMin: null, diferenciaMin: null, tipo: 'SIN_CAPACIDAD' })
  })

  it('detecta la coincidencia exacta con la jornada', () => {
    const desviacion = evaluarDesviacion(2400, 2400)
    expect(desviacion.tipo).toBe('CUADRA')
    expect(desviacion.diferenciaMin).toBe(0)
  })

  it('marca exceso cuando se imputa más que la capacidad', () => {
    const desviacion = evaluarDesviacion(2700, 2400)
    expect(desviacion.tipo).toBe('EXCESO')
    expect(desviacion.diferenciaMin).toBe(300)
  })

  it('marca defecto cuando se imputa menos que la capacidad', () => {
    const desviacion = evaluarDesviacion(2100, 2400)
    expect(desviacion.tipo).toBe('DEFECTO')
    expect(desviacion.diferenciaMin).toBe(-300)
  })

  it('trata la capacidad cero con horas como exceso', () => {
    const desviacion = evaluarDesviacion(480, 0)
    expect(desviacion.tipo).toBe('EXCESO')
    expect(desviacion.diferenciaMin).toBe(480)
  })
})

describe('requiereJustificacion', () => {
  it('no exige motivo en una semana en curso', () => {
    const desviacion = evaluarDesviacion(1200, 2400)
    expect(requiereJustificacion(desviacion, { semanaCerrada: false })).toBe(false)
  })

  it('exige motivo en una semana cerrada con defecto', () => {
    const desviacion = evaluarDesviacion(2100, 2400)
    expect(requiereJustificacion(desviacion, { semanaCerrada: true })).toBe(true)
  })

  it('exige motivo en una semana cerrada con exceso', () => {
    const desviacion = evaluarDesviacion(2700, 2400)
    expect(requiereJustificacion(desviacion, { semanaCerrada: true })).toBe(true)
  })

  it('no exige motivo si el total cuadra', () => {
    const desviacion = evaluarDesviacion(2400, 2400)
    expect(requiereJustificacion(desviacion, { semanaCerrada: true })).toBe(false)
  })

  it('no exige motivo sin capacidad configurada', () => {
    const desviacion = evaluarDesviacion(1200, null)
    expect(requiereJustificacion(desviacion, { semanaCerrada: true })).toBe(false)
  })
})

describe('validarMotivoDesviacion', () => {
  it('rechaza el texto vacío', () => {
    expect(validarMotivoDesviacion('   ')).not.toBeNull()
  })

  it('rechaza un texto demasiado corto', () => {
    expect(validarMotivoDesviacion('corto')).not.toBeNull()
  })

  it('acepta un motivo razonable', () => {
    expect(validarMotivoDesviacion(MOTIVO_VALIDO)).toBeNull()
  })

  it('rechaza un texto por encima del máximo', () => {
    expect(validarMotivoDesviacion('a'.repeat(501))).not.toBeNull()
  })
})

describe('describirDesviacion', () => {
  it('describe el exceso con signo y formato de reloj', () => {
    expect(describirDesviacion(evaluarDesviacion(2700, 2400))).toContain('+5:00')
  })

  it('describe la ausencia de capacidad', () => {
    expect(describirDesviacion(evaluarDesviacion(0, null))).toContain('Sin jornada')
  })
})
