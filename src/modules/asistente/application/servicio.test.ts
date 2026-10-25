import type { EntradaAuditoria } from '@/modules/auditoria/application/registrar'
import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import type { SemanaIso } from '@/modules/partes/domain/fechas'
import { AppError } from '@/shared/errors'
import type { DatosBriefing, DatosParte } from '../domain/contexto'
import type { DepsAsistente, MensajeLLM, ProveedorLLM } from './ports'
import {
  normalizarSalida,
  redactarMotivoRechazo,
  resumirSemana,
} from './servicio'

const USUARIO: UsuarioSesion = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'encargado@levitec.es',
  nombre: 'Encargado',
  rol: 'ENCARGADO',
  empleadoId: null,
  empresaId: '22222222-2222-2222-2222-222222222222',
}

const PARTE_ID = '33333333-3333-3333-3333-333333333333'

const SEMANA: SemanaIso = {
  isoYear: 2026,
  isoWeek: 43,
  weekStart: '2026-10-19',
  weekEnd: '2026-10-25',
}

const DATOS_BRIEFING: DatosBriefing = {
  semana: { isoYear: 2026, isoWeek: 43, rango: '19/10/2026 a 25/10/2026' },
  totales: { minutos: 2_520, partes: 12, empleados: 14, pendientes: 3 },
  cumplimiento: {
    pct: 78,
    sinParte: 2,
    borradores: 3,
    rechazados: 1,
    enviados: 3,
    aprobados: 8,
  },
  personas: [],
  proyectos: [],
}

const DATOS_PARTE: DatosParte = {
  empleado: 'Ana María Torres Gil',
  semana: { isoYear: 2026, isoWeek: 43, rango: '19/10/2026 a 25/10/2026' },
  estado: 'ENVIADO',
  totalMinutos: 2_100,
  motivoPrevio: null,
  lineas: [
    { fecha: '2026-10-19', proyecto: 'Obra norte', tarea: 'Encofrado', minutos: 420, nota: null },
  ],
}

function proveedor(valor: string, sobreescribir: Partial<ProveedorLLM> = {}): ProveedorLLM {
  return {
    nombre: 'modelo-test',
    disponible: () => true,
    completar: async () => ({ texto: valor, tokensEntrada: 10, tokensSalida: 5 }),
    ...sobreescribir,
  }
}

function deps(parcial: Partial<DepsAsistente> = {}, auditorias: EntradaAuditoria[] = []): DepsAsistente {
  return {
    proveedor: proveedor('Resumen de la semana.'),
    consultas: {
      briefing: async () => DATOS_BRIEFING,
      parte: async () => DATOS_PARTE,
    },
    auditoria: async (entrada) => {
      auditorias.push(entrada)
    },
    limite: { consumir: () => true },
    ahora: () => new Date('2026-10-25T10:00:00.000Z'),
    pseudonimizar: () => true,
    ...parcial,
  }
}

describe('normalizarSalida', () => {
  it('elimina vallas de bloque y líneas vacías de más', () => {
    expect(normalizarSalida('```text\nResumen\n\n\n\nFinal\n```')).toBe('Resumen\n\nFinal')
  })

  it('recorta a 1500 caracteres', () => {
    expect(normalizarSalida('a'.repeat(1_600))).toHaveLength(1_500)
  })
})

describe('resumirSemana', () => {
  it('devuelve el texto del proveedor y audita solo metadatos', async () => {
    const auditorias: EntradaAuditoria[] = []
    const mensajes: MensajeLLM[][] = []

    const resultado = await resumirSemana(
      deps(
        {
          proveedor: proveedor('Resumen de la semana.', {
            completar: async (entrada) => {
              mensajes.push(entrada)
              return { texto: 'Resumen de la semana.', tokensEntrada: 10, tokensSalida: 5 }
            },
          }),
        },
        auditorias,
      ),
      USUARIO,
      SEMANA,
    )

    expect(resultado.texto).toBe('Resumen de la semana.')
    expect(mensajes).toHaveLength(1)
    expect(auditorias).toHaveLength(1)
    expect(auditorias[0]).toMatchObject({
      actorId: USUARIO.id,
      entidad: 'asistente_ia',
      accion: 'BRIEFING',
      despues: { modelo: 'modelo-test', tokensEntrada: 10, tokensSalida: 5 },
    })

    const serializada = JSON.stringify(auditorias[0])
    expect(serializada).not.toContain('Resumen de la semana.')
    expect(serializada).not.toContain('<datos>')
  })

  it('falla como no configurado sin proveedor y no consulta la base de datos', async () => {
    let consultas = 0
    const dependencias = deps({
      proveedor: proveedor('x', { disponible: () => false }),
      consultas: {
        briefing: async () => {
          consultas += 1
          return DATOS_BRIEFING
        },
        parte: async () => DATOS_PARTE,
      },
    })

    await expect(resumirSemana(dependencias, USUARIO, SEMANA)).rejects.toMatchObject({
      codigo: 'NO_CONFIGURADO',
    })
    expect(consultas).toBe(0)
  })

  it('respeta el límite de consumo', async () => {
    const dependencias = deps({ limite: { consumir: () => false } })

    await expect(resumirSemana(dependencias, USUARIO, SEMANA)).rejects.toMatchObject({
      codigo: 'DEMASIADAS_PETICIONES',
    })
  })

  it('traduce un fallo inesperado del proveedor sin filtrar detalles', async () => {
    const dependencias = deps({
      proveedor: proveedor('x', {
        completar: async () => {
          throw new Error('detalle interno del proveedor')
        },
      }),
    })

    await expect(resumirSemana(dependencias, USUARIO, SEMANA)).rejects.toMatchObject({
      codigo: 'SERVICIO_EXTERNO',
      message: 'El asistente no está disponible en este momento',
    })
  })

  it('rechaza una respuesta vacía', async () => {
    const dependencias = deps({ proveedor: proveedor('   ') })

    await expect(resumirSemana(dependencias, USUARIO, SEMANA)).rejects.toMatchObject({
      codigo: 'SERVICIO_EXTERNO',
    })
  })
})

describe('redactarMotivoRechazo', () => {
  it('pide el parte al caso de uso autorizado y devuelve el borrador', async () => {
    let pedido: string | null = null

    const dependencias = deps({
      proveedor: proveedor('Revisa las horas del martes, por favor.'),
      consultas: {
        briefing: async () => DATOS_BRIEFING,
        parte: async (_usuario, parteId) => {
          pedido = parteId
          return DATOS_PARTE
        },
      },
    })

    const resultado = await redactarMotivoRechazo(dependencias, USUARIO, PARTE_ID)

    expect(pedido).toBe(PARTE_ID)
    expect(resultado.texto).toBe('Revisa las horas del martes, por favor.')
  })

  it('propaga el error de alcance del caso de uso de partes', async () => {
    const dependencias = deps({
      consultas: {
        briefing: async () => DATOS_BRIEFING,
        parte: async () => {
          throw new AppError('NO_ENCONTRADO', 'El parte no existe o no está en tu ámbito')
        },
      },
    })

    await expect(redactarMotivoRechazo(dependencias, USUARIO, PARTE_ID)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    })
  })
})
