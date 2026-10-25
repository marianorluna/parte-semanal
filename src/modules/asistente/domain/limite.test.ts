import { consumirVentana, ventanaMinuto, ventanaSegundo, type EstadoLimite } from './limite'

describe('ventanaMinuto', () => {
  it('agrupa instantes del mismo minuto', () => {
    const primero = new Date('2026-10-25T10:00:01.000Z')
    const segundo = new Date('2026-10-25T10:00:59.999Z')
    expect(ventanaMinuto(primero)).toBe(ventanaMinuto(segundo))
  })

  it('cambia al minuto siguiente', () => {
    const primero = new Date('2026-10-25T10:00:59.999Z')
    const segundo = new Date('2026-10-25T10:01:00.000Z')
    expect(ventanaMinuto(segundo)).toBe(ventanaMinuto(primero) + 1)
  })
})

describe('ventanaSegundo', () => {
  it('cambia cada segundo', () => {
    const primero = new Date('2026-10-25T10:00:00.100Z')
    const segundo = new Date('2026-10-25T10:00:01.100Z')
    expect(ventanaSegundo(segundo)).toBe(ventanaSegundo(primero) + 1)
  })
})

describe('consumirVentana', () => {
  const ahora = new Date('2026-10-25T10:00:00.000Z')

  it('permite la primera llamada y bloquea la segunda en el mismo segundo', () => {
    const primera = consumirVentana(undefined, ahora, 20, 1)
    expect(primera.permitido).toBe(true)

    const segunda = consumirVentana(primera.siguiente, ahora, 20, 1)
    expect(segunda.permitido).toBe(false)
    expect(segunda.siguiente.porSegundo).toBe(1)
  })

  it('vuelve a permitir al cambiar de segundo', () => {
    const primera = consumirVentana(undefined, ahora, 20, 1)
    const siguienteSegundo = new Date(ahora.getTime() + 1_000)

    expect(consumirVentana(primera.siguiente, siguienteSegundo, 20, 1).permitido).toBe(true)
  })

  it('respeta el límite por minuto y se reinicia en el minuto siguiente', () => {
    let estado: EstadoLimite | undefined
    for (let indice = 0; indice < 3; indice += 1) {
      const resultado = consumirVentana(estado, new Date(ahora.getTime() + indice * 1_000), 3, 10)
      expect(resultado.permitido).toBe(true)
      estado = resultado.siguiente
    }

    const bloqueada = consumirVentana(estado, new Date(ahora.getTime() + 4_000), 3, 10)
    expect(bloqueada.permitido).toBe(false)

    const siguienteMinuto = new Date(ahora.getTime() + 60_000)
    expect(consumirVentana(bloqueada.siguiente, siguienteMinuto, 3, 10).permitido).toBe(true)
  })
})
