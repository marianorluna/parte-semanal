import { exportadorNominaCsv, importadorFichajeCsv } from './adaptadores'

describe('exportador de nómina CSV', () => {
  it('genera cabecera, BOM y minutos/horas por línea', () => {
    const csv = exportadorNominaCsv.exportar([
      {
        empleadoCodigo: 'E001',
        empleadoNombre: 'Ana Pérez',
        fecha: '2026-10-23',
        proyectoCodigo: 'PRY-1',
        tareaCodigo: 'T-1',
        tipoHora: 'NORMAL',
        minutos: 90,
      },
    ])

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('empleado_codigo;empleado_nombre')
    expect(csv).toContain('E001;Ana Pérez;2026-10-23;PRY-1;T-1;NORMAL;90;1,50')
  })

  it('escapa separadores y comillas en los textos', () => {
    const csv = exportadorNominaCsv.exportar([
      {
        empleadoCodigo: 'E001',
        empleadoNombre: 'Pérez; Ana "La"',
        fecha: '2026-10-23',
        proyectoCodigo: 'PRY-1',
        tareaCodigo: 'T-1',
        tipoHora: 'NORMAL',
        minutos: 60,
      },
    ])

    expect(csv).toContain('"Pérez; Ana ""La"""')
  })
})

describe('importador de fichajes CSV', () => {
  it('acepta cabeceras con separador de coma en cualquier orden', () => {
    const resultado = importadorFichajeCsv.importar(
      'fecha,minutos,empleado_codigo\n2026-10-20,480,E001\n',
    )
    expect(resultado.errores).toEqual([])
    expect(resultado.lineas).toEqual([
      { empleadoCodigo: 'E001', fecha: '2026-10-20', minutos: 480 },
    ])
  })

  it('devuelve errores por fila sin abortar el lote', () => {
    const resultado = importadorFichajeCsv.importar(
      '\uFEFFempleado_codigo;fecha;minutos\nE001;2026-10-20;480\n;2026-10-21;60\nE002;21/10/2026;60\nE003;2026-10-22;0\n',
    )

    expect(resultado.lineas).toHaveLength(1)
    expect(resultado.errores.map((error) => error.linea)).toEqual([3, 4, 5])
  })

  it('rechaza una cabecera incompleta', () => {
    const resultado = importadorFichajeCsv.importar('empleado_codigo;fecha\nE001;2026-10-20\n')
    expect(resultado.lineas).toEqual([])
    expect(resultado.errores[0]?.linea).toBe(1)
  })
})
