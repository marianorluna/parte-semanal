import {
  estadoCumplimiento,
  ordenarPorPrioridad,
  pendienteDeRevision,
  requiereAccionDelTrabajador,
  resumirCumplimiento,
} from './cumplimiento'

describe('estadoCumplimiento', () => {
  it('devuelve SIN_PARTE cuando no hay parte', () => {
    expect(estadoCumplimiento({ estado: null })).toBe('SIN_PARTE')
  })

  it('respeta el estado del parte', () => {
    expect(estadoCumplimiento({ estado: 'ENVIADO' })).toBe('ENVIADO')
  })
})

describe('requiereAccionDelTrabajador', () => {
  it('incluye sin parte, borrador y rechazado', () => {
    expect(requiereAccionDelTrabajador('SIN_PARTE')).toBe(true)
    expect(requiereAccionDelTrabajador('BORRADOR')).toBe(true)
    expect(requiereAccionDelTrabajador('RECHAZADO')).toBe(true)
  })

  it('excluye enviado y aprobado', () => {
    expect(requiereAccionDelTrabajador('ENVIADO')).toBe(false)
    expect(requiereAccionDelTrabajador('APROBADO')).toBe(false)
  })
})

describe('pendienteDeRevision', () => {
  it('solo el enviado espera al encargado', () => {
    expect(pendienteDeRevision('ENVIADO')).toBe(true)
    expect(pendienteDeRevision('APROBADO')).toBe(false)
    expect(pendienteDeRevision('SIN_PARTE')).toBe(false)
  })
})

describe('resumirCumplimiento', () => {
  it('cuenta estados y calcula el cumplimiento', () => {
    const resumen = resumirCumplimiento([
      { estado: 'APROBADO' },
      { estado: 'APROBADO' },
      { estado: 'ENVIADO' },
      { estado: 'BORRADOR' },
      { estado: 'RECHAZADO' },
      { estado: null },
    ])

    expect(resumen.total).toBe(6)
    expect(resumen.aprobados).toBe(2)
    expect(resumen.enviados).toBe(1)
    expect(resumen.borradores).toBe(1)
    expect(resumen.rechazados).toBe(1)
    expect(resumen.sinParte).toBe(1)
    expect(resumen.pendientesDelTrabajador).toBe(3)
    expect(resumen.cumplimientoPct).toBe(50)
  })

  it('devuelve cero sin empleados', () => {
    const resumen = resumirCumplimiento([])
    expect(resumen.total).toBe(0)
    expect(resumen.cumplimientoPct).toBe(0)
  })
})

describe('ordenarPorPrioridad', () => {
  it('coloca primero lo que bloquea el cierre', () => {
    const filas = ordenarPorPrioridad([
      { nombre: 'Aprobado', estado: 'APROBADO' as const },
      { nombre: 'Sin parte', estado: 'SIN_PARTE' as const },
      { nombre: 'Enviado', estado: 'ENVIADO' as const },
      { nombre: 'Borrador', estado: 'BORRADOR' as const },
      { nombre: 'Rechazado', estado: 'RECHAZADO' as const },
    ])

    expect(filas.map((fila) => fila.nombre)).toEqual([
      'Sin parte',
      'Borrador',
      'Rechazado',
      'Enviado',
      'Aprobado',
    ])
  })
})
