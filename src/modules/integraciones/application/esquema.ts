/**
 * Contratos de la API v1. Las mismas definiciones Zod validan la petición y
 * generan el documento OpenAPI con `z.toJSONSchema`, sin dependencias extra.
 */

import { z } from 'zod'
import { ALCANCES, EVENTOS } from '../domain/api'

export const estadosParte = z.enum([
  'BORRADOR',
  'ENVIADO',
  'APROBADO',
  'RECHAZADO',
  'BLOQUEADO',
])

export const listaPartesQuery = z.object({
  isoYear: z.coerce.number().int().min(2000).max(2100).optional(),
  isoWeek: z.coerce.number().int().min(1).max(53).optional(),
  estado: estadosParte.optional(),
  empleadoId: z.uuid().optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
})

export const imputacionBody = z.object({
  empleadoId: z.uuid(),
  fecha: z.iso.date(),
  tareaId: z.uuid(),
  minutos: z.number().int().min(1, 'Los minutos deben ser mayores que 0').max(1440),
})

export const parteApi = z.object({
  id: z.uuid(),
  empleadoId: z.uuid(),
  empleadoCodigo: z.string(),
  empleadoNombre: z.string(),
  isoYear: z.number().int(),
  isoWeek: z.number().int(),
  weekStart: z.string(),
  estado: estadosParte,
  totalMinutos: z.number().int(),
  version: z.number().int(),
  enviadoAt: z.string().nullable(),
  revisadoAt: z.string().nullable(),
})

export const proyectoApi = z.object({
  id: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
  activo: z.boolean(),
})

export const imputacionRespuesta = z.object({
  parteId: z.uuid(),
  imputacionId: z.uuid(),
  totalMinutos: z.number().int(),
  version: z.number().int(),
})

export const errorApi = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
  }),
})

export const eventoApi = z.enum(EVENTOS)
export const alcanceApi = z.enum(ALCANCES)

function sinMeta(esquema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(esquema, { target: 'openapi-3.0' }) as Record<string, unknown>
  delete json.$schema
  return json
}

/** Documento OpenAPI 3.0 construido desde los contratos Zod. */
export function generarOpenApi(): Record<string, unknown> {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Parte semanal - API v1',
      version: '1.0.0',
      description:
        'API de lectura de partes y proyectos y de escritura de imputaciones. Autenticación con clave Bearer.',
    },
    servers: [{ url: '/api/v1' }],
    security: [{ claveApi: [] }],
    components: {
      securitySchemes: {
        claveApi: {
          type: 'http',
          scheme: 'bearer',
          description: 'Clave con formato lv_<prefijo>_<secreto>',
        },
      },
      schemas: {
        Parte: sinMeta(parteApi),
        Proyecto: sinMeta(proyectoApi),
        Imputacion: sinMeta(imputacionRespuesta),
        Error: sinMeta(errorApi),
      },
    },
    paths: {
      '/partes': {
        get: {
          summary: 'Lista partes de la empresa',
          parameters: [
            { name: 'isoYear', in: 'query', schema: { type: 'integer' } },
            { name: 'isoWeek', in: 'query', schema: { type: 'integer' } },
            { name: 'estado', in: 'query', schema: { type: 'string' } },
            { name: 'empleadoId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'limite', in: 'query', schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            '200': {
              description: 'Listado',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/Parte' } },
                    },
                  },
                },
              },
            },
            '401': { description: 'Clave ausente o inválida' },
            '429': { description: 'Límite de peticiones superado' },
          },
        },
      },
      '/proyectos': {
        get: {
          summary: 'Lista proyectos de la empresa',
          responses: {
            '200': {
              description: 'Listado',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/Proyecto' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/imputaciones': {
        post: {
          summary: 'Crea o actualiza una imputación',
          description:
            'Requiere la cabecera Idempotency-Key. La tarea debe estar asignada al empleado y el parte no puede estar enviado ni aprobado.',
          parameters: [
            {
              name: 'Idempotency-Key',
              in: 'header',
              required: true,
              schema: { type: 'string', minLength: 8, maxLength: 128 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: sinMeta(imputacionBody) },
            },
          },
          responses: {
            '201': {
              description: 'Imputación guardada',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/Imputacion' },
                    },
                  },
                },
              },
            },
            '409': { description: 'Periodo cerrado, estado del parte o clave en curso' },
            '422': { description: 'Validación' },
          },
        },
      },
    },
  }
}
