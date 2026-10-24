import { bandejaSoloTrabajadores, puedeRevisarParte } from './permisos'

describe('puedeRevisarParte', () => {
  it('el encargado revisa solo partes de trabajadores', () => {
    expect(puedeRevisarParte('ENCARGADO', 'TRABAJADOR')).toBe(true)
    expect(puedeRevisarParte('ENCARGADO', 'ENCARGADO')).toBe(false)
    expect(puedeRevisarParte('ENCARGADO', 'ADMIN')).toBe(false)
    expect(puedeRevisarParte('ENCARGADO', null)).toBe(false)
  })

  it('el admin revisa cualquier parte, incluida la suya', () => {
    expect(puedeRevisarParte('ADMIN', 'TRABAJADOR')).toBe(true)
    expect(puedeRevisarParte('ADMIN', 'ENCARGADO')).toBe(true)
    expect(puedeRevisarParte('ADMIN', 'ADMIN')).toBe(true)
    expect(puedeRevisarParte('ADMIN', null)).toBe(true)
  })

  it('el trabajador no revisa', () => {
    expect(puedeRevisarParte('TRABAJADOR', 'TRABAJADOR')).toBe(false)
  })
})

describe('bandejaSoloTrabajadores', () => {
  it('limita la bandeja del encargado y no la del admin', () => {
    expect(bandejaSoloTrabajadores('ENCARGADO')).toBe(true)
    expect(bandejaSoloTrabajadores('ADMIN')).toBe(false)
    expect(bandejaSoloTrabajadores('TRABAJADOR')).toBe(false)
  })
})
