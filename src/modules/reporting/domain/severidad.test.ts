import type { ResumenRiesgo } from './riesgo'
import {
  peorSeveridad,
  severidadAntiguedad,
  severidadCumplimiento,
  severidadDesdeNivelRiesgo,
  severidadPendientesRevision,
  severidadProyectosEnRiesgo,
  severidadSinEnviar,
  type Severidad,
} from './severidad'

const SIN_RIESGO: ResumenRiesgo = { total: 10, agotados: 0, criticos: 0, avisos: 0, ok: 10, sinDatos: 0 }

describe('severidadCumplimiento', () => {
  it('considera correcto el 90% o más', () => {
    expect(severidadCumplimiento(100)).toBe('OK')
    expect(severidadCumplimiento(90)).toBe('OK')
  })

  it('avisa entre el 70% y el 89%', () => {
    expect(severidadCumplimiento(89)).toBe('AVISO')
    expect(severidadCumplimiento(70)).toBe('AVISO')
  })

  it('alerta por debajo del 70%', () => {
    expect(severidadCumplimiento(69)).toBe('ALERTA')
    expect(severidadCumplimiento(44)).toBe('ALERTA')
  })
})

describe('severidadAntiguedad', () => {
  it('queda neutra sin partes pendientes', () => {
    expect(severidadAntiguedad(0)).toBe('NEUTRO')
  })

  it('avisa a partir del sexto día', () => {
    expect(severidadAntiguedad(5)).toBe('OK')
    expect(severidadAntiguedad(6)).toBe('AVISO')
    expect(severidadAntiguedad(10)).toBe('AVISO')
    expect(severidadAntiguedad(11)).toBe('ALERTA')
  })
})

describe('severidadPendientesRevision', () => {
  it('escala con el volumen de partes sin revisar', () => {
    expect(severidadPendientesRevision(0)).toBe('OK')
    expect(severidadPendientesRevision(1)).toBe('AVISO')
    expect(severidadPendientesRevision(4)).toBe('AVISO')
    expect(severidadPendientesRevision(5)).toBe('ALERTA')
  })
})

describe('severidadSinEnviar', () => {
  it('tolera una o dos personas rezagadas', () => {
    expect(severidadSinEnviar(0)).toBe('OK')
    expect(severidadSinEnviar(2)).toBe('AVISO')
    expect(severidadSinEnviar(3)).toBe('ALERTA')
  })
})

describe('severidadProyectosEnRiesgo', () => {
  it('marca OK sin proyectos en riesgo', () => {
    expect(severidadProyectosEnRiesgo(SIN_RIESGO)).toBe('OK')
  })

  it('avisa cuando solo hay proyectos a vigilar', () => {
    expect(severidadProyectosEnRiesgo({ ...SIN_RIESGO, avisos: 3 })).toBe('AVISO')
  })

  it('un solo proyecto agotado domina a diez avisos', () => {
    expect(severidadProyectosEnRiesgo({ ...SIN_RIESGO, agotados: 1, avisos: 10 })).toBe('ALERTA')
    expect(severidadProyectosEnRiesgo({ ...SIN_RIESGO, criticos: 1 })).toBe('ALERTA')
  })
})

describe('severidadDesdeNivelRiesgo', () => {
  it('traduce cada nivel del riesgo de proyecto', () => {
    expect(severidadDesdeNivelRiesgo('AGOTADO')).toBe('ALERTA')
    expect(severidadDesdeNivelRiesgo('CRITICO')).toBe('ALERTA')
    expect(severidadDesdeNivelRiesgo('AVISO')).toBe('AVISO')
    expect(severidadDesdeNivelRiesgo('OK')).toBe('OK')
    expect(severidadDesdeNivelRiesgo('SIN_PRESUPUESTO')).toBe('NEUTRO')
    expect(severidadDesdeNivelRiesgo('SIN_PLAZO')).toBe('NEUTRO')
  })
})

describe('peorSeveridad', () => {
  it('es conmutativa y la alerta domina', () => {
    const casos: [Severidad, Severidad][] = [
      ['OK', 'NEUTRO'],
      ['AVISO', 'OK'],
      ['ALERTA', 'AVISO'],
      ['NEUTRO', 'ALERTA'],
    ]

    expect(peorSeveridad('OK', 'NEUTRO')).toBe('OK')
    expect(peorSeveridad('NEUTRO', 'OK')).toBe('OK')
    for (const [a, b] of casos) {
      expect(peorSeveridad(a, b)).toBe(peorSeveridad(b, a))
    }
    expect(peorSeveridad('ALERTA', 'AVISO')).toBe('ALERTA')
  })
})
