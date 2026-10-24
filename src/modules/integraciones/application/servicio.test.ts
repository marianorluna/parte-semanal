import { AppError } from '@/shared/errors'
import type { DepsIntegraciones, RepositorioIntegraciones } from './ports'
import {
  autenticarApi,
  entregarPendientes,
  procesarOutbox,
} from './servicio'

const PREFIJO = 'abcdef123456'
const CLAVE = `lv_${PREFIJO}_${'a'.repeat(40)}`

function repositorioFalso(
  overrides: Partial<RepositorioIntegraciones> = {},
): RepositorioIntegraciones {
  const base: RepositorioIntegraciones = {
    crearClave: async () => 'clave-1',
    clavePorPrefijo: async () => null,
    marcarUso: async () => {},
    consumirLimite: async () => true,
    listarClaves: async () => [],
    revocarClave: async () => true,
    crearWebhook: async () => 'webhook-1',
    listarWebhooks: async () => [],
    cambiarEstadoWebhook: async () => true,
    webhooksPara: async () => [],
    outboxPendientes: async () => [],
    marcarOutboxProcesado: async () => {},
    crearEntrega: async () => {},
    entregasPendientes: async () => [],
    marcarEntregaEnviada: async () => {},
    marcarEntregaFallida: async () => {},
    listarEntregas: async () => [],
    reclamarIdempotencia: async () => ({ id: 'idem-1', respuesta: null, reclamada: true }),
    guardarRespuestaIdempotencia: async () => {},
    liberarIdempotencia: async () => {},
    escribirImputacion: async () => ({
      parteId: 'parte-1',
      imputacionId: 'imputacion-1',
      totalMinutos: 60,
      version: 2,
    }),
  }
  return { ...base, ...overrides }
}

function depsFalso(repo: RepositorioIntegraciones): DepsIntegraciones {
  return {
    repo,
    enviarWebhook: async () => ({ ok: true }),
    ahora: () => new Date('2026-10-24T10:00:00Z'),
    generarCredenciales: () => ({ prefijo: PREFIJO, secreto: 'a'.repeat(40), clave: CLAVE }),
    hashClave: (clave) => clave,
    generarSecretoWebhook: () => 'secreto',
  }
}

describe('autenticación de claves', () => {
  it('acepta una clave vigente con el alcance requerido', async () => {
    const repo = repositorioFalso({
      clavePorPrefijo: async () => ({
        id: 'clave-1',
        empresaId: 'empresa-1',
        activo: true,
        caducaAt: new Date('2027-01-01T00:00:00Z'),
        hash: CLAVE,
        alcances: ['partes:leer'],
      }),
    })

    const contexto = await autenticarApi(depsFalso(repo), `Bearer ${CLAVE}`, 'partes:leer')
    expect(contexto.empresaId).toBe('empresa-1')
    expect(contexto.alcances).toEqual(['partes:leer'])
  })

  it('rechaza una clave caducada aunque el hash coincida', async () => {
    const repo = repositorioFalso({
      clavePorPrefijo: async () => ({
        id: 'clave-1',
        empresaId: 'empresa-1',
        activo: true,
        caducaAt: new Date('2026-01-01T00:00:00Z'),
        hash: CLAVE,
        alcances: ['partes:leer'],
      }),
    })

    await expect(
      autenticarApi(depsFalso(repo), `Bearer ${CLAVE}`, 'partes:leer'),
    ).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' })
  })

  it('rechaza un alcance no concedido', async () => {
    const repo = repositorioFalso({
      clavePorPrefijo: async () => ({
        id: 'clave-1',
        empresaId: 'empresa-1',
        activo: true,
        caducaAt: null,
        hash: CLAVE,
        alcances: ['partes:leer'],
      }),
    })

    await expect(
      autenticarApi(depsFalso(repo), `Bearer ${CLAVE}`, 'imputaciones:escribir'),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('rechaza cuando se supera el rate limit', async () => {
    const repo = repositorioFalso({
      clavePorPrefijo: async () => ({
        id: 'clave-1',
        empresaId: 'empresa-1',
        activo: true,
        caducaAt: null,
        hash: CLAVE,
        alcances: ['partes:leer'],
      }),
      consumirLimite: async () => false,
    })

    await expect(
      autenticarApi(depsFalso(repo), `Bearer ${CLAVE}`, 'partes:leer'),
    ).rejects.toMatchObject({ codigo: 'DEMASIADAS_PETICIONES' })
  })
})

describe('despacho de webhooks', () => {
  it('no lanza si el webhook está caído y programa el reintento', async () => {
    const fallos: { id: string; mensaje: string; agotada: boolean }[] = []
    const repo = repositorioFalso({
      entregasPendientes: async () => [
        {
          id: 'entrega-1',
          webhookUrl: 'https://ejemplo.com/hook',
          webhookSecreto: 'secreto',
          evento: 'parte.aprobado',
          payload: { parteId: 'parte-1' },
          intentos: 0,
        },
      ],
      marcarEntregaFallida: async (id, mensaje, _proximo, agotada) => {
        fallos.push({ id, mensaje, agotada })
      },
    })

    const deps = depsFalso(repo)
    deps.enviarWebhook = async () => ({ ok: false, mensaje: 'HTTP 500' })

    const resumen = await entregarPendientes(deps)
    expect(resumen).toEqual({ enviadas: 0, fallidas: 1, agotadas: 0 })
    expect(fallos).toEqual([{ id: 'entrega-1', mensaje: 'HTTP 500', agotada: false }])
  })

  it('marca enviada cuando el destino responde', async () => {
    let enviada = ''
    const repo = repositorioFalso({
      entregasPendientes: async () => [
        {
          id: 'entrega-1',
          webhookUrl: 'https://ejemplo.com/hook',
          webhookSecreto: 'secreto',
          evento: 'parte.aprobado',
          payload: {},
          intentos: 2,
        },
      ],
      marcarEntregaEnviada: async (id) => {
        enviada = id
      },
    })

    const resumen = await entregarPendientes(depsFalso(repo))
    expect(resumen.enviadas).toBe(1)
    expect(enviada).toBe('entrega-1')
  })

  it('un error al crear la entrega no detiene el despacho ni marca el outbox', async () => {
    const procesados: string[] = []
    const repo = repositorioFalso({
      outboxPendientes: async () => [
        {
          id: 'evento-1',
          empresaId: 'empresa-1',
          evento: 'parte.aprobado',
          payload: { parteId: 'parte-1' },
        },
      ],
      webhooksPara: async () => [{ id: 'webhook-1' }],
      crearEntrega: async () => {
        throw new Error('webhook caído')
      },
      marcarOutboxProcesado: async (id) => {
        procesados.push(id)
      },
    })

    await expect(procesarOutbox(depsFalso(repo))).resolves.toEqual({
      procesados: 0,
      entregas: 0,
    })
    expect(procesados).toEqual([])
  })

  it('crea una entrega por webhook y marca el outbox procesado', async () => {
    const creadas: string[] = []
    const procesados: string[] = []
    const repo = repositorioFalso({
      outboxPendientes: async () => [
        {
          id: 'evento-1',
          empresaId: 'empresa-1',
          evento: 'parte.aprobado',
          payload: { parteId: 'parte-1' },
        },
      ],
      webhooksPara: async () => [{ id: 'webhook-1' }, { id: 'webhook-2' }],
      crearEntrega: async (datos) => {
        creadas.push(`${datos.webhookId}:${datos.outboxId}`)
      },
      marcarOutboxProcesado: async (id) => {
        procesados.push(id)
      },
    })

    const resumen = await procesarOutbox(depsFalso(repo))
    expect(resumen).toEqual({ procesados: 1, entregas: 2 })
    expect(creadas).toEqual(['webhook-1:evento-1', 'webhook-2:evento-1'])
    expect(procesados).toEqual(['evento-1'])
  })
})
