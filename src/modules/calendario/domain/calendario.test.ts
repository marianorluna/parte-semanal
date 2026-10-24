import {
  CALENDARIO_POR_DEFECTO,
  capacidadSemanal,
  diaSemanaIso,
  normalizarDiasSemana,
  resolverDia,
  resolverSemana,
  textoMotivo,
} from './calendario'
import {
  festivosComunidad,
  festivosDeReferencia,
  festivosNacionales,
  fusionarFestivos,
  nombreComunidad,
  pascua,
} from './festivos-espana'

describe('pascua', () => {
  it('calcula el domingo de Pascua de los próximos años', () => {
    expect(pascua(2024)).toBe('2024-03-31')
    expect(pascua(2025)).toBe('2025-04-20')
    expect(pascua(2026)).toBe('2026-04-05')
    expect(pascua(2027)).toBe('2027-03-28')
  })
})

describe('festivos nacionales', () => {
  it('coloca el Viernes Santo dos días antes de Pascua', () => {
    const festivos = festivosNacionales(2026)
    expect(festivos.find((festivo) => festivo.nombre === 'Viernes Santo')?.fecha).toBe('2026-04-03')
  })

  it('mantiene las diez fechas nacionales sin duplicados', () => {
    const festivos = festivosNacionales(2027)
    expect(festivos).toHaveLength(10)
    expect(new Set(festivos.map((festivo) => festivo.fecha)).size).toBe(10)
    expect(festivos.every((festivo) => festivo.ambito === 'NACIONAL')).toBe(true)
  })
})

describe('festivos de comunidad', () => {
  it('añade el festivo propio y el Lunes de Pascua cuando corresponde', () => {
    const cataluna = festivosComunidad(2026, 'CT')
    expect(cataluna.map((festivo) => festivo.fecha)).toEqual(['2026-04-06', '2026-09-11', '2026-12-26'])
  })

  it('no inventa festivos para una comunidad desconocida', () => {
    expect(festivosComunidad(2026, 'ZZ')).toEqual([])
    expect(nombreComunidad('MD')).toBe('Comunidad de Madrid')
  })

  it('incluye los festivos nacionales al pedir la referencia completa', () => {
    const referencia = festivosDeReferencia(2026, 'MD')
    expect(referencia).toHaveLength(11)
    expect(referencia.every((festivo) => festivo.fecha.startsWith('2026'))).toBe(true)
  })
})

describe('fusionarFestivos', () => {
  it('da prioridad al ámbito más concreto en la misma fecha', () => {
    const fusionados = fusionarFestivos(
      [{ fecha: '2026-05-02', nombre: 'Nacional', ambito: 'NACIONAL' }],
      [{ fecha: '2026-05-02', nombre: 'Madrid', ambito: 'CCAA', comunidad: 'MD' }],
      [{ fecha: '2026-05-02', nombre: 'Local', ambito: 'LOCAL' }],
    )

    expect(fusionados).toHaveLength(1)
    expect(fusionados[0]?.nombre).toBe('Local')
  })

  it('ordena por fecha', () => {
    const fusionados = fusionarFestivos([
      { fecha: '2026-12-25', nombre: 'Navidad', ambito: 'NACIONAL' },
      { fecha: '2026-01-01', nombre: 'Año Nuevo', ambito: 'NACIONAL' },
    ])

    expect(fusionados.map((festivo) => festivo.fecha)).toEqual(['2026-01-01', '2026-12-25'])
  })
})

describe('resolverDia', () => {
  it('marca el fin de semana como no laborable con motivo', () => {
    const sabado = resolverDia(CALENDARIO_POR_DEFECTO, '2026-10-24')
    expect(sabado.laborable).toBe(false)
    expect(sabado.motivo).toEqual({ tipo: 'FIN_DE_SEMANA' })
    expect(sabado.diaSemana).toBe(6)
    expect(textoMotivo(sabado.motivo)).toBe('Fin de semana')
  })

  it('marca un festivo aunque sea entre semana', () => {
    const dia = resolverDia(
      {
        ...CALENDARIO_POR_DEFECTO,
        festivos: [{ fecha: '2026-12-08', nombre: 'Inmaculada', ambito: 'NACIONAL', esLaborable: false }],
      },
      '2026-12-08',
    )

    expect(dia.laborable).toBe(false)
    expect(textoMotivo(dia.motivo)).toBe('Festivo: Inmaculada')
  })

  it('permite abrir un sábado con una excepción', () => {
    const dia = resolverDia(
      {
        ...CALENDARIO_POR_DEFECTO,
        excepciones: [{ fecha: '2026-10-24', laborable: true, motivo: 'Inventario' }],
      },
      '2026-10-24',
    )

    expect(dia.laborable).toBe(true)
    expect(dia.motivo).toBeNull()
  })

  it('permite cerrar un día laborable con una excepción', () => {
    const dia = resolverDia(
      {
        ...CALENDARIO_POR_DEFECTO,
        excepciones: [{ fecha: '2026-12-24', laborable: false, motivo: 'Nochebuena' }],
      },
      '2026-12-24',
    )

    expect(dia.laborable).toBe(false)
    expect(textoMotivo(dia.motivo)).toBe('Nochebuena')
  })

  it('la excepción gana a un festivo de la misma fecha', () => {
    const dia = resolverDia(
      {
        ...CALENDARIO_POR_DEFECTO,
        festivos: [{ fecha: '2026-12-24', nombre: 'Nochebuena', ambito: 'EMPRESA', esLaborable: false }],
        excepciones: [{ fecha: '2026-12-24', laborable: true, motivo: 'Cierre de obra' }],
      },
      '2026-12-24',
    )

    expect(dia.laborable).toBe(true)
  })

  it('un festivo marcado como laborable no cierra el día', () => {
    const dia = resolverDia(
      {
        ...CALENDARIO_POR_DEFECTO,
        festivos: [{ fecha: '2026-12-08', nombre: 'Inmaculada', ambito: 'NACIONAL', esLaborable: true }],
      },
      '2026-12-08',
    )

    expect(dia.laborable).toBe(true)
  })

  it('respeta un calendario con sábado laborable', () => {
    const dia = resolverDia({ ...CALENDARIO_POR_DEFECTO, diasSemana: [1, 2, 3, 4, 5, 6] }, '2026-10-24')
    expect(dia.laborable).toBe(true)
  })
})

describe('resolverSemana', () => {
  it('devuelve siete días desde el lunes con la jornada teórica', () => {
    const dias = resolverSemana(
      { ...CALENDARIO_POR_DEFECTO, horasDiariasMin: 480 },
      '2026-10-19',
    )

    expect(dias).toHaveLength(7)
    expect(dias[0]?.fecha).toBe('2026-10-19')
    expect(dias[6]?.fecha).toBe('2026-10-25')
    expect(capacidadSemanal(dias)).toBe(2400)
    expect(dias.filter((dia) => dia.laborable)).toHaveLength(5)
  })

  it('sin jornada diaria la capacidad es desconocida', () => {
    expect(capacidadSemanal(resolverSemana(CALENDARIO_POR_DEFECTO, '2026-10-19'))).toBeNull()
  })
})

describe('utilidades', () => {
  it('mapea domingo a 7 y lunes a 1', () => {
    expect(diaSemanaIso('2026-10-19')).toBe(1)
    expect(diaSemanaIso('2026-10-25')).toBe(7)
  })

  it('normaliza los días de la semana', () => {
    expect(normalizarDiasSemana([6, 1, 6, 9, 0, 3])).toEqual([1, 3, 6])
  })
})
