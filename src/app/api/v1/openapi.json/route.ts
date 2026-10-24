import { generarOpenApi } from '@/modules/integraciones/application/esquema'

export const dynamic = 'force-static'

/** Documento OpenAPI 3.0 generado desde los contratos Zod de la API. */
export function GET(): Response {
  return Response.json(generarOpenApi(), {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  })
}
