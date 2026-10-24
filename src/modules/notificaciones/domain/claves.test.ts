import {
  claveEquipoPendiente,
  claveRecordatorio,
  claveRecordatorioManual,
  claveRiesgoProyecto,
} from './claves'

const SEMANA = { isoYear: 2026, isoWeek: 43 }

describe('claves de idempotencia', () => {
  it('la misma ventana produce la misma clave', () => {
    const primera = claveRecordatorio('u1', SEMANA, 'viernes', '2026-10-23')
    const segunda = claveRecordatorio('u1', SEMANA, 'viernes', '2026-10-23')

    expect(primera).toBe(segunda)
  })

  it('cambia con el usuario, la semana y la ventana', () => {
    const base = claveRecordatorio('u1', SEMANA, 'viernes', '2026-10-23')

    expect(claveRecordatorio('u2', SEMANA, 'viernes', '2026-10-23')).not.toBe(base)
    expect(claveRecordatorio('u1', { ...SEMANA, isoWeek: 44 }, 'viernes', '2026-10-23')).not.toBe(base)
    expect(claveRecordatorio('u1', SEMANA, 'lunes', '2026-10-23')).not.toBe(base)
  })

  it('el recordatorio manual cambia a diario para no silenciar avisos legítimos', () => {
    const hoy = claveRecordatorioManual('u1', SEMANA, '2026-10-23')
    const manana = claveRecordatorioManual('u1', SEMANA, '2026-10-24')

    expect(hoy).not.toBe(manana)
  })

  it('el resumen al encargado no colisiona con el recordatorio del trabajador', () => {
    const trabajador = claveRecordatorio('u1', SEMANA, 'viernes', '2026-10-23')
    const encargado = claveEquipoPendiente('u1', SEMANA, 'viernes', '2026-10-23')

    expect(trabajador).not.toBe(encargado)
  })

  it('el aviso de riesgo incluye proyecto, nivel y fecha', () => {
    const base = claveRiesgoProyecto('u1', 'p1', 'CRITICO', '2026-10-24')

    expect(base).not.toBe(claveRiesgoProyecto('u1', 'p1', 'CRITICO', '2026-10-25'))
    expect(base).not.toBe(claveRiesgoProyecto('u1', 'p1', 'AVISO', '2026-10-24'))
    expect(base).not.toBe(claveRiesgoProyecto('u1', 'p2', 'CRITICO', '2026-10-24'))
  })

  it('la semana se normaliza con dos dígitos', () => {
    expect(claveRecordatorio('u1', { isoYear: 2026, isoWeek: 3 }, 'lunes', '2026-01-12')).toContain('2026-W03')
  })
})
