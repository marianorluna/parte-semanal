/**
 * `compose.yml` inyecta variables vacías cuando no están definidas. El entorno
 * debe tratarlas como ausentes y aplicar los valores por defecto, o la app no
 * arranca. Estas pruebas cubren también los topes numéricos del asistente.
 */

const BASE = {
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test',
  AUTH_SECRET: 'a'.repeat(32),
}

function preparar(extra: Record<string, string> = {}): void {
  for (const [clave, valor] of Object.entries({ ...BASE, ...extra })) {
    vi.stubEnv(clave, valor)
  }
}

async function cargarEnv() {
  vi.resetModules()
  const modulo = await import('./env')
  return modulo.env()
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('configuración del asistente de IA', () => {
  it('trata las variables vacías como ausentes y aplica los valores por defecto', async () => {
    preparar({
      IA_API_KEY: '',
      IA_MODELO: '',
      IA_BASE_URL: '',
      IA_TIMEOUT_MS: '',
      IA_MAX_TOKENS: '',
      IA_PSEUDONIMIZAR: '',
    })

    const valor = await cargarEnv()

    expect(valor.IA_API_KEY).toBeUndefined()
    expect(valor.IA_MODELO).toBeUndefined()
    expect(valor.IA_BASE_URL).toBe('https://api.deepseek.com')
    expect(valor.IA_TIMEOUT_MS).toBe(20_000)
    expect(valor.IA_MAX_TOKENS).toBe(700)
    expect(valor.IA_PSEUDONIMIZAR).toBe(true)
  })

  it('desactiva la pseudonimización con el valor false', async () => {
    preparar({ IA_PSEUDONIMIZAR: 'false' })
    expect((await cargarEnv()).IA_PSEUDONIMIZAR).toBe(false)
  })

  it('acepta un proveedor distinto sin tocar código', async () => {
    preparar({
      IA_API_KEY: 'clave-de-prueba-larga',
      IA_BASE_URL: 'https://openrouter.ai/api/v1',
      IA_MODELO: 'modelo-elegido',
    })

    const valor = await cargarEnv()
    expect(valor.IA_BASE_URL).toBe('https://openrouter.ai/api/v1')
    expect(valor.IA_MODELO).toBe('modelo-elegido')
  })

  it('rechaza un timeout fuera de rango', async () => {
    preparar({ IA_TIMEOUT_MS: '0' })
    await expect(cargarEnv()).rejects.toThrow(/IA_TIMEOUT_MS/)
  })

  it('rechaza una clave demasiado corta', async () => {
    preparar({ IA_API_KEY: 'corta' })
    await expect(cargarEnv()).rejects.toThrow(/IA_API_KEY/)
  })
})
