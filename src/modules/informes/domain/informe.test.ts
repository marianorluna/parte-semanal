import {
  ErrorInforme,
  exigirDentroDeLimite,
  firmarDescarga,
  nombreArchivoInforme,
  periodoMensual,
  validarParametros,
  verificarDescarga,
} from './informe'

describe('validarParametros', () => {
  it('acepta una certificación mensual válida', () => {
    const resultado = validarParametros('CERTIFICACION_MENSUAL', { anio: 2026, mes: 10 })
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.parametros.mes).toBe(10)
  })

  it('rechaza meses fuera de rango con el campo señalado', () => {
    const resultado = validarParametros('CERTIFICACION_MENSUAL', { anio: 2026, mes: 13 })
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.campo).toBe('mes')
  })

  it('rechaza rangos invertidos y mayores de un año', () => {
    const invertido = validarParametros('LIBRO_JORNADA', { desde: '2026-10-10', hasta: '2026-10-01' })
    expect(invertido.ok).toBe(false)

    const largo = validarParametros('AUSENCIAS', { desde: '2025-01-01', hasta: '2026-06-01' })
    expect(largo.ok).toBe(false)
    if (!largo.ok) expect(largo.campo).toBe('hasta')
  })
})

describe('firma de descarga', () => {
  const secreto = 'secreto-de-pruebas-con-mas-de-32-caracteres'

  it('acepta un token recién firmado antes de caducar', () => {
    const token = firmarDescarga('informe-1', 2_000, secreto)
    expect(verificarDescarga('informe-1', token, secreto, 1_999)).toEqual({ ok: true })
  })

  it('rechaza un token caducado', () => {
    const token = firmarDescarga('informe-1', 1_000, secreto)
    expect(verificarDescarga('informe-1', token, secreto, 1_001)).toEqual({ ok: false, motivo: 'CADUCADO' })
  })

  it('rechaza un token manipulado o de otro informe', () => {
    const token = firmarDescarga('informe-1', 2_000, secreto)
    expect(verificarDescarga('informe-2', token, secreto, 1_000)).toEqual({ ok: false, motivo: 'INVALIDO' })
    expect(verificarDescarga('informe-1', `2000.${'0'.repeat(64)}`, secreto, 1_000)).toEqual({
      ok: false,
      motivo: 'INVALIDO',
    })
    expect(verificarDescarga('informe-1', 'basura', secreto, 1_000)).toEqual({ ok: false, motivo: 'INVALIDO' })
  })
})

describe('límite y nombres', () => {
  it('corta los informes que superan 10.000 filas', () => {
    expect(() => exigirDentroDeLimite(new Array(10_000).fill({}))).not.toThrow()
    expect(() => exigirDentroDeLimite(new Array(10_001).fill({}))).toThrow(ErrorInforme)
  })

  it('genera el nombre de archivo con el tipo y la referencia', () => {
    expect(nombreArchivoInforme('LIBRO_JORNADA', 'XLSX', '2026-10')).toBe(
      'libro-jornada-2026-10.xlsx',
    )
  })

  it('calcula el periodo mensual incluyendo febrero bisiesto', () => {
    expect(periodoMensual(2028, 2)).toMatchObject({ desde: '2028-02-01', hasta: '2028-02-29' })
    expect(periodoMensual(2026, 12)).toMatchObject({ desde: '2026-12-01', hasta: '2026-12-31' })
  })
})
