import {
  compararSeguro,
  entregaAgotada,
  firmaValida,
  firmarWebhook,
  proximoIntento,
} from './firma'

const SECRETO = 'secreto-de-prueba'
const CUERPO = JSON.stringify({ id: '1', evento: 'parte.aprobado' })

describe('firma de webhooks', () => {
  it('valida la firma del mismo cuerpo y timestamp', () => {
    const timestamp = 1_800_000_000
    const firma = firmarWebhook(SECRETO, timestamp, CUERPO)
    expect(firmaValida(SECRETO, timestamp, CUERPO, firma, timestamp)).toBe(true)
  })

  it('rechaza un cuerpo manipulado', () => {
    const timestamp = 1_800_000_000
    const firma = firmarWebhook(SECRETO, timestamp, CUERPO)
    expect(
      firmaValida(SECRETO, timestamp, CUERPO.replace('aprobado', 'rechazado'), firma, timestamp),
    ).toBe(false)
  })

  it('rechaza una firma de otro secreto', () => {
    const timestamp = 1_800_000_000
    const firma = firmarWebhook('otro-secreto', timestamp, CUERPO)
    expect(firmaValida(SECRETO, timestamp, CUERPO, firma, timestamp)).toBe(false)
  })

  it('rechaza timestamps fuera de la tolerancia', () => {
    const timestamp = 1_800_000_000
    const firma = firmarWebhook(SECRETO, timestamp, CUERPO)
    expect(firmaValida(SECRETO, timestamp, CUERPO, firma, timestamp + 301)).toBe(false)
  })
})

describe('reintentos', () => {
  const ahora = new Date('2026-10-24T10:00:00Z')

  it('aplica backoff creciente por intento', () => {
    expect(proximoIntento(1, ahora).toISOString()).toBe('2026-10-24T10:01:00.000Z')
    expect(proximoIntento(2, ahora).toISOString()).toBe('2026-10-24T10:05:00.000Z')
    expect(proximoIntento(3, ahora).toISOString()).toBe('2026-10-24T10:15:00.000Z')
  })

  it('marca agotada al alcanzar el máximo', () => {
    expect(entregaAgotada(4)).toBe(false)
    expect(entregaAgotada(5)).toBe(true)
  })

  it('compara hashes en tiempo constante y con distinta longitud', () => {
    expect(compararSeguro('abc', 'abc')).toBe(true)
    expect(compararSeguro('abc', 'abd')).toBe(false)
    expect(compararSeguro('abc', 'abcd')).toBe(false)
  })
})
