import { esEditable, puedeTransicionar, validarParte } from './parte'

const TAREA_A = '11111111-1111-1111-1111-111111111111'
const TAREA_B = '22222222-2222-2222-2222-222222222222'

describe('validarParte', () => {
  const weekStart = '2026-10-19'

  it('acepta imputaciones de la semana y calcula el total', () => {
    const resultado = validarParte(weekStart, [
      { fecha: '2026-10-19', tareaId: TAREA_A, minutos: 480 },
      { fecha: '2026-10-20', tareaId: TAREA_A, minutos: 240 },
      { fecha: '2026-10-20', tareaId: TAREA_B, minutos: 240 },
    ])

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.totalMinutos).toBe(960)
      expect(resultado.minutosPorDia['2026-10-20']).toBe(480)
    }
  })

  it('rechaza una fecha fuera de la semana', () => {
    const resultado = validarParte(weekStart, [
      { fecha: '2026-10-26', tareaId: TAREA_A, minutos: 480 },
    ])
    expect(resultado.ok).toBe(false)
  })

  it('rechaza la misma tarea dos veces en el mismo día', () => {
    const resultado = validarParte(weekStart, [
      { fecha: '2026-10-19', tareaId: TAREA_A, minutos: 240 },
      { fecha: '2026-10-19', tareaId: TAREA_A, minutos: 240 },
    ])
    expect(resultado.ok).toBe(false)
  })

  it('rechaza minutos no positivos', () => {
    const resultado = validarParte(weekStart, [
      { fecha: '2026-10-19', tareaId: TAREA_A, minutos: 0 },
    ])
    expect(resultado.ok).toBe(false)
  })

  it('rechaza un día con más de 24 horas en total', () => {
    const resultado = validarParte(weekStart, [
      { fecha: '2026-10-19', tareaId: TAREA_A, minutos: 1440 },
      { fecha: '2026-10-19', tareaId: TAREA_B, minutos: 60 },
    ])
    expect(resultado.ok).toBe(false)
  })

  it('rechaza el envío de un parte vacío', () => {
    expect(validarParte(weekStart, []).ok).toBe(false)
  })

  it('permite el borrador vacío cuando se indica', () => {
    const resultado = validarParte(weekStart, [], { permitirVacio: true })
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.totalMinutos).toBe(0)
  })
})

describe('estados del parte', () => {
  it('solo permite editar borradores y rechazados', () => {
    expect(esEditable('BORRADOR')).toBe(true)
    expect(esEditable('RECHAZADO')).toBe(true)
    expect(esEditable('ENVIADO')).toBe(false)
    expect(esEditable('APROBADO')).toBe(false)
  })

  it('aplica la máquina de estados', () => {
    expect(puedeTransicionar('BORRADOR', 'ENVIADO')).toBe(true)
    expect(puedeTransicionar('ENVIADO', 'APROBADO')).toBe(true)
    expect(puedeTransicionar('ENVIADO', 'RECHAZADO')).toBe(true)
    expect(puedeTransicionar('ENVIADO', 'BORRADOR')).toBe(true)
    expect(puedeTransicionar('APROBADO', 'BORRADOR')).toBe(true)
    expect(puedeTransicionar('BORRADOR', 'APROBADO')).toBe(false)
    expect(puedeTransicionar('RECHAZADO', 'APROBADO')).toBe(false)
  })
})
