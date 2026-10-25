export type CodigoError =
  | 'NO_AUTENTICADO'
  | 'SIN_PERMISO'
  | 'NO_ENCONTRADO'
  | 'VALIDACION'
  | 'ESTADO_INVALIDO'
  | 'CONFLICTO_VERSION'
  | 'DEMASIADAS_PETICIONES'
  | 'NO_CONFIGURADO'
  | 'SERVICIO_EXTERNO'
  | 'ERROR_INTERNO'

const ESTADOS_HTTP: Record<CodigoError, number> = {
  NO_AUTENTICADO: 401,
  SIN_PERMISO: 403,
  NO_ENCONTRADO: 404,
  VALIDACION: 422,
  ESTADO_INVALIDO: 409,
  CONFLICTO_VERSION: 409,
  DEMASIADAS_PETICIONES: 429,
  NO_CONFIGURADO: 503,
  SERVICIO_EXTERNO: 502,
  ERROR_INTERNO: 500,
}

export class AppError extends Error {
  readonly codigo: CodigoError
  readonly status: number
  readonly detalles?: Record<string, string>

  constructor(codigo: CodigoError, mensaje: string, detalles?: Record<string, string>) {
    super(mensaje)
    this.name = 'AppError'
    this.codigo = codigo
    this.status = ESTADOS_HTTP[codigo]
    this.detalles = detalles
  }
}

export type RespuestaError = {
  success: false
  error: { code: CodigoError; message: string; fieldErrors?: Record<string, string> }
}

export type RespuestaOk<T> = { success: true; data: T }

export type Respuesta<T> = RespuestaOk<T> | RespuestaError

export function ok<T>(data: T): RespuestaOk<T> {
  return { success: true, data }
}

export function fallo(error: unknown): RespuestaError {
  if (error instanceof AppError) {
    return {
      success: false,
      error: { code: error.codigo, message: error.message, fieldErrors: error.detalles },
    }
  }

  console.error('[error-no-controlado]', error)
  return {
    success: false,
    error: { code: 'ERROR_INTERNO', message: 'Se ha producido un error inesperado' },
  }
}
