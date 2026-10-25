import type { MensajeLLM } from '../application/ports'
import { crearProveedorOpenAICompatible, type ConfiguracionProveedor } from './openai-compatible'

const MENSAJES: MensajeLLM[] = [{ rol: 'usuario', contenido: 'Resume la semana' }]

const CONFIG: ConfiguracionProveedor = {
  apiKey: 'clave-de-prueba',
  baseUrl: 'https://api.deepseek.com',
  modelo: 'modelo-test',
  timeoutMs: 1_000,
  maxTokens: 700,
}

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status })
}

function montarFetch(): ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>> {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('crearProveedorOpenAICompatible', () => {
  it('no está disponible sin clave o sin modelo', () => {
    expect(crearProveedorOpenAICompatible({ ...CONFIG, apiKey: undefined }).disponible()).toBe(false)
    expect(crearProveedorOpenAICompatible({ ...CONFIG, modelo: undefined }).disponible()).toBe(false)
    expect(crearProveedorOpenAICompatible(CONFIG).disponible()).toBe(true)
  })

  it('lanza NO_CONFIGURADO sin clave y no llama a fetch', async () => {
    const fetchMock = montarFetch()
    const proveedor = crearProveedorOpenAICompatible({ ...CONFIG, apiKey: undefined })

    await expect(proveedor.completar(MENSAJES)).rejects.toMatchObject({ codigo: 'NO_CONFIGURADO' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía el modelo, los mensajes y el tope de tokens', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockResolvedValue(
      respuestaJson({ choices: [{ message: { content: 'Hola' } }], usage: { prompt_tokens: 7, completion_tokens: 3 } }),
    )

    const resultado = await crearProveedorOpenAICompatible(CONFIG).completar(MENSAJES)

    expect(resultado).toEqual({ texto: 'Hola', tokensEntrada: 7, tokensSalida: 3 })

    const llamada = fetchMock.mock.calls[0]
    expect(llamada?.[0]).toBe('https://api.deepseek.com/chat/completions')

    const init = llamada?.[1]
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer clave-de-prueba' })

    const cuerpo = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(cuerpo).toMatchObject({ model: 'modelo-test', max_tokens: 700, stream: false })
    // El protocolo de OpenAI exige `system`/`user`: enviar `sistema`/`usuario`
    // hacía que el proveedor respondiera 400.
    expect(cuerpo.messages).toEqual([{ role: 'user', content: 'Resume la semana' }])
  })

  it('traduce los roles del dominio a los del protocolo de OpenAI', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockResolvedValue(respuestaJson({ choices: [{ message: { content: 'Hola' } }] }))

    await crearProveedorOpenAICompatible(CONFIG).completar([
      { rol: 'sistema', contenido: 'Instrucciones' },
      { rol: 'usuario', contenido: 'Datos' },
    ])

    const init = fetchMock.mock.calls[0]?.[1]
    const cuerpo = JSON.parse(String(init?.body)) as { messages: unknown }
    expect(cuerpo.messages).toEqual([
      { role: 'system', content: 'Instrucciones' },
      { role: 'user', content: 'Datos' },
    ])
  })

  it('acepta que se pegue la ruta completa en la URL base', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockResolvedValue(respuestaJson({ choices: [{ message: { content: 'Hola' } }] }))

    await crearProveedorOpenAICompatible({
      ...CONFIG,
      baseUrl: 'https://api.deepseek.com/chat/completions',
    }).completar(MENSAJES)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.deepseek.com/chat/completions')
  })

  it('normaliza la barra final de la URL', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockResolvedValue(respuestaJson({ choices: [{ message: { content: 'Hola' } }] }))

    await crearProveedorOpenAICompatible({ ...CONFIG, baseUrl: 'https://api.openai.com/v1/' }).completar(
      MENSAJES,
    )

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('devuelve tokens cero cuando el proveedor no informa del uso', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockResolvedValue(respuestaJson({ choices: [{ message: { content: 'Hola' } }] }))

    expect(await crearProveedorOpenAICompatible(CONFIG).completar(MENSAJES)).toEqual({
      texto: 'Hola',
      tokensEntrada: 0,
      tokensSalida: 0,
    })
  })

  it('traduce un HTTP de error', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockResolvedValue(new Response('limitado', { status: 429 }))

    await expect(crearProveedorOpenAICompatible(CONFIG).completar(MENSAJES)).rejects.toMatchObject({
      codigo: 'SERVICIO_EXTERNO',
    })
  })

  it('traduce un JSON inválido', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockResolvedValue(new Response('no es json', { status: 200 }))

    await expect(crearProveedorOpenAICompatible(CONFIG).completar(MENSAJES)).rejects.toMatchObject({
      codigo: 'SERVICIO_EXTERNO',
    })
  })

  it('traduce una respuesta sin opciones', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockResolvedValue(respuestaJson({ choices: [] }))

    await expect(crearProveedorOpenAICompatible(CONFIG).completar(MENSAJES)).rejects.toMatchObject({
      codigo: 'SERVICIO_EXTERNO',
    })
  })

  it('traduce un contenido vacío', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockResolvedValue(respuestaJson({ choices: [{ message: { content: '  ' } }] }))

    await expect(crearProveedorOpenAICompatible(CONFIG).completar(MENSAJES)).rejects.toMatchObject({
      codigo: 'SERVICIO_EXTERNO',
    })
  })

  it('traduce un fallo de red o de timeout', async () => {
    const fetchMock = montarFetch()
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))

    await expect(crearProveedorOpenAICompatible(CONFIG).completar(MENSAJES)).rejects.toMatchObject({
      codigo: 'SERVICIO_EXTERNO',
    })
  })
})
