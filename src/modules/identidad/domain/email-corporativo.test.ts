import { DOMINIO_CORPORATIVO, emailCorporativo } from './email-corporativo'

describe('emailCorporativo', () => {
  it('usa la inicial del nombre y el apellido', () => {
    expect(emailCorporativo('David Sierra')).toBe(`dsierra${DOMINIO_CORPORATIVO}`)
    expect(DOMINIO_CORPORATIVO).toBe('@levitec.es')
  })

  it('elimina acentos y eñes', () => {
    expect(emailCorporativo('Álvaro Méndez')).toBe('amendez@levitec.es')
    expect(emailCorporativo('Nuria Peña')).toBe('npena@levitec.es')
    expect(emailCorporativo('Víctor Sanchís')).toBe('vsanchis@levitec.es')
  })

  it('ignora las partículas del apellido', () => {
    expect(emailCorporativo('María de la Fuente')).toBe('mfuente@levitec.es')
  })

  it('concatena los apellidos compuestos', () => {
    expect(emailCorporativo('Ana García López')).toBe('agarcialopez@levitec.es')
  })

  it('tolera espacios sobrantes', () => {
    expect(emailCorporativo('  David   Sierra  ')).toBe('dsierra@levitec.es')
  })

  it('falla sin nombre o sin apellido', () => {
    expect(() => emailCorporativo('')).toThrow()
    expect(() => emailCorporativo('David')).toThrow()
    expect(() => emailCorporativo('David de la')).toThrow()
  })
})
