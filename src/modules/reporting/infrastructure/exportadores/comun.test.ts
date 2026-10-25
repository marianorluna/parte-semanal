import { nombreArchivo } from './comun'

describe('nombreArchivo', () => {
  it('compone el nombre con el formato pedido', () => {
    expect(nombreArchivo('partes-2026-W43', 'csv')).toBe('partes-2026-w43.csv')
    expect(nombreArchivo('dashboard-2026-W43', 'xlsx')).toBe('dashboard-2026-w43.xlsx')
    expect(nombreArchivo('dashboard-2026-W43', 'pdf')).toBe('dashboard-2026-w43.pdf')
  })

  it('quita acentos y diéresis', () => {
    expect(nombreArchivo('Diseño Año', 'pdf')).toBe('diseno-ano.pdf')
  })

  it('normaliza espacios y separadores repetidos', () => {
    expect(nombreArchivo('Partes  2026 // W43', 'csv')).toBe('partes-2026-w43.csv')
  })

  it('recorta guiones sobrantes en los extremos', () => {
    expect(nombreArchivo('---informe---', 'pdf')).toBe('informe.pdf')
  })

  it('cae en un nombre genérico si la base queda vacía', () => {
    expect(nombreArchivo('', 'csv')).toBe('informe.csv')
    expect(nombreArchivo('///', 'xlsx')).toBe('informe.xlsx')
  })
})
