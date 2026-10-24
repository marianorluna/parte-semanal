import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const TIPOS_INFORME = [
  'CERTIFICACION_MENSUAL',
  'LIBRO_JORNADA',
  'COSTES_PROYECTO',
  'AUSENCIAS',
  'HORAS_EXTRA',
  'AUDITORIA',
] as const

export type TipoInforme = (typeof TIPOS_INFORME)[number]

export const ETIQUETAS_TIPO_INFORME: Record<TipoInforme, string> = {
  CERTIFICACION_MENSUAL: 'Certificación mensual',
  LIBRO_JORNADA: 'Libro de jornada',
  COSTES_PROYECTO: 'Costes por proyecto',
  AUSENCIAS: 'Ausencias',
  HORAS_EXTRA: 'Horas extra',
  AUDITORIA: 'Auditoría',
}

export const FORMATOS_INFORME = ['CSV', 'XLSX', 'PDF'] as const
export type FormatoInforme = (typeof FORMATOS_INFORME)[number]

export type EstadoInforme = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'FALLIDO'

export const ETIQUETAS_ESTADO_INFORME: Record<EstadoInforme, string> = {
  PENDIENTE: 'En cola',
  EN_PROCESO: 'Generando',
  COMPLETADO: 'Listo',
  FALLIDO: 'Fallido',
}

/** Tope de filas por informe: 10.000 filas no bloquean la petición ni la memoria. */
export const LIMITE_FILAS = 10_000
export const MAX_DIAS_RANGO = 366
export const MINUTOS_CADUCIDAD = 60

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

const rango = z
  .object({ desde: fecha, hasta: fecha })
  .refine((valor) => valor.desde <= valor.hasta, {
    message: 'La fecha inicial no puede superar la final',
    path: ['desde'],
  })
  .refine(
    (valor) => {
      const inicio = Date.parse(`${valor.desde}T00:00:00Z`)
      const fin = Date.parse(`${valor.hasta}T00:00:00Z`)
      return Number.isFinite(inicio) && Number.isFinite(fin) && (fin - inicio) / 86_400_000 <= MAX_DIAS_RANGO
    },
    { message: `El rango no puede superar ${MAX_DIAS_RANGO} días`, path: ['hasta'] },
  )

const rangoCostes = z
  .object({ desde: fecha, hasta: fecha, proyectoId: z.uuid().nullable().optional() })
  .refine((valor) => valor.desde <= valor.hasta, {
    message: 'La fecha inicial no puede superar la final',
    path: ['desde'],
  })
  .refine(
    (valor) => {
      const inicio = Date.parse(`${valor.desde}T00:00:00Z`)
      const fin = Date.parse(`${valor.hasta}T00:00:00Z`)
      return Number.isFinite(inicio) && Number.isFinite(fin) && (fin - inicio) / 86_400_000 <= MAX_DIAS_RANGO
    },
    { message: `El rango no puede superar ${MAX_DIAS_RANGO} días`, path: ['hasta'] },
  )

export const parametrosPorTipo = {
  CERTIFICACION_MENSUAL: z.object({
    anio: z.number().int().min(2000).max(2100),
    mes: z.number().int().min(1).max(12),
  }),
  LIBRO_JORNADA: rango,
  COSTES_PROYECTO: rangoCostes,
  AUSENCIAS: rango,
  HORAS_EXTRA: rango,
  AUDITORIA: rango,
} as const

export type ParametrosInforme = {
  CERTIFICACION_MENSUAL: z.infer<(typeof parametrosPorTipo)['CERTIFICACION_MENSUAL']>
  LIBRO_JORNADA: z.infer<(typeof parametrosPorTipo)['LIBRO_JORNADA']>
  COSTES_PROYECTO: z.infer<(typeof parametrosPorTipo)['COSTES_PROYECTO']>
  AUSENCIAS: z.infer<(typeof parametrosPorTipo)['AUSENCIAS']>
  HORAS_EXTRA: z.infer<(typeof parametrosPorTipo)['HORAS_EXTRA']>
  AUDITORIA: z.infer<(typeof parametrosPorTipo)['AUDITORIA']>
}

export type ResultadoParametros<T extends TipoInforme> =
  | { ok: true; parametros: ParametrosInforme[T] }
  | { ok: false; campo: string; mensaje: string }

export function validarParametros<T extends TipoInforme>(
  tipo: T,
  entrada: unknown,
): ResultadoParametros<T> {
  const esquema = parametrosPorTipo[tipo]
  const lectura = esquema.safeParse(entrada)
  if (!lectura.success) {
    const issue = lectura.error.issues[0]
    return {
      ok: false,
      campo: issue?.path.join('.') || 'parametros',
      mensaje: issue?.message ?? 'Parámetros no válidos',
    }
  }
  return { ok: true, parametros: lectura.data as ParametrosInforme[T] }
}

export type ColumnaInforme = {
  clave: string
  etiqueta: string
  tipo: 'texto' | 'numero' | 'importe' | 'fecha'
  ancho?: number
}

export type FilaInforme = Record<string, string | number | null>

export type ResumenInforme = { etiqueta: string; valor: string }

export type TablaInforme = {
  titulo: string
  subtitulo: string
  columnas: ColumnaInforme[]
  filas: FilaInforme[]
  resumen: ResumenInforme[]
}

export class ErrorInforme extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErrorInforme'
  }
}

/** Corta y avisa si un informe supera el tope: nunca genera un fichero parcial. */
export function exigirDentroDeLimite(filas: readonly unknown[]): void {
  if (filas.length > LIMITE_FILAS) {
    throw new ErrorInforme(
      `El informe tiene ${filas.length} filas y el máximo es ${LIMITE_FILAS}. Reduce el rango o filtra por proyecto.`,
    )
  }
}

export function nombreArchivoInforme(
  tipo: TipoInforme,
  formato: FormatoInforme,
  referencia: string,
): string {
  const base = `${tipo.toLowerCase().replace(/_/g, '-')}-${referencia}`
  return `${base}.${formato.toLowerCase()}`
}

const TIPO_MIME: Record<FormatoInforme, string> = {
  CSV: 'text/csv; charset=utf-8',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PDF: 'application/pdf',
}

export function mimeDeFormato(formato: FormatoInforme): string {
  return TIPO_MIME[formato]
}

/**
 * Token de descarga firmado con HMAC. Incluye la caducidad en el propio token
 * para no depender de estado de sesión adicional. La comprobación es en tiempo
 * constante para no filtrar información por temporización.
 */
export function firmarDescarga(informeId: string, expiraEpoch: number, secreto: string): string {
  const firma = createHmac('sha256', secreto).update(`${informeId}.${expiraEpoch}`).digest('hex')
  return `${expiraEpoch}.${firma}`
}

export function verificarDescarga(
  informeId: string,
  token: string,
  secreto: string,
  ahoraEpoch: number,
): { ok: true } | { ok: false; motivo: 'CADUCADO' | 'INVALIDO' } {
  const [expiraTexto, firma] = token.split('.')
  const expira = Number(expiraTexto)
  if (!expiraTexto || !firma || !Number.isInteger(expira)) return { ok: false, motivo: 'INVALIDO' }

  const esperada = createHmac('sha256', secreto).update(`${informeId}.${expira}`).digest()
  const recibida = Buffer.from(firma, 'hex')
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
    return { ok: false, motivo: 'INVALIDO' }
  }
  if (expira < ahoraEpoch) return { ok: false, motivo: 'CADUCADO' }
  return { ok: true }
}

export function periodoMensual(anio: number, mes: number): { desde: string; hasta: string; etiqueta: string } {
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  const mm = String(mes).padStart(2, '0')
  const etiqueta = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, mes - 1, 1)),
  )
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimoDia).padStart(2, '0')}`, etiqueta }
}
