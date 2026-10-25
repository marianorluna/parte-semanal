import { proyectarSemanaAnterior } from './copia'
import { semanaIso } from './fechas'

const ORIGEN = semanaIso(2026, 42)
const DESTINO = semanaIso(2026, 43)

const TAREA_A = 'tarea-a'
const TAREA_B = 'tarea-b'

function base(opciones: Partial<Parameters<typeof proyectarSemanaAnterior>[1]> = {}) {
  return {
    semanaOrigen: ORIGEN,
    semanaDestino: DESTINO,
    tareasPermitidas: new Set([TAREA_A, TAREA_B]),
    diasNoLaborables: new Set<string>(),
    minutosOcupados: new Map<string, number>(),
    ...opciones,
  }
}

describe('proyección de la semana anterior', () => {
  it('traslada cada imputación al mismo día de la semana destino', () => {
    const resultado = proyectarSemanaAnterior(
      [
        { fecha: '2026-10-19', tareaId: TAREA_A, minutos: 480 },
        { fecha: '2026-10-21', tareaId: TAREA_B, minutos: 240 },
      ],
      base(),
    )

    expect(resultado.filas).toEqual([
      { fecha: '2026-10-26', tareaId: TAREA_A, minutos: 480 },
      { fecha: '2026-10-28', tareaId: TAREA_B, minutos: 240 },
    ])
    expect(resultado.totalMinutos).toBe(720)
    expect(resultado.omitidas).toBe(0)
  })

  it('descarta tareas que ya no están asignadas', () => {
    const resultado = proyectarSemanaAnterior(
      [
        { fecha: '2026-10-19', tareaId: TAREA_A, minutos: 480 },
        { fecha: '2026-10-19', tareaId: 'tarea-vieja', minutos: 60 },
      ],
      base(),
    )

    expect(resultado.filas).toHaveLength(1)
    expect(resultado.omitidas).toBe(1)
  })

  it('no escribe en días no laborables del calendario destino', () => {
    const resultado = proyectarSemanaAnterior(
      [
        { fecha: '2026-10-24', tareaId: TAREA_A, minutos: 240 },
        { fecha: '2026-10-19', tareaId: TAREA_A, minutos: 480 },
      ],
      base({ diasNoLaborables: new Set(['2026-10-31']) }),
    )

    expect(resultado.filas).toEqual([{ fecha: '2026-10-26', tareaId: TAREA_A, minutos: 480 }])
    expect(resultado.omitidas).toBe(1)
  })

  it('respeta las 24 horas diarias contando lo ya imputado', () => {
    const resultado = proyectarSemanaAnterior(
      [
        { fecha: '2026-10-19', tareaId: TAREA_A, minutos: 600 },
        { fecha: '2026-10-19', tareaId: TAREA_B, minutos: 600 },
      ],
      base({ minutosOcupados: new Map([['2026-10-26', 600]]) }),
    )

    expect(resultado.filas).toEqual([{ fecha: '2026-10-26', tareaId: TAREA_A, minutos: 600 }])
    expect(resultado.omitidas).toBe(1)
  })

  it('sin imputaciones no devuelve filas', () => {
    expect(proyectarSemanaAnterior([], base())).toEqual({
      filas: [],
      totalMinutos: 0,
      omitidas: 0,
    })
  })
})
