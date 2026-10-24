import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRol } from '@/modules/identidad/application/sesion'
import { hoyEnZona, semanaIso, semanaIsoDe } from '@/modules/partes/domain/fechas'
import { minutosAHorasDecimal } from '@/modules/partes/domain/horas'
import { datosPartes } from '@/modules/reporting/application/exportacion'
import { nombreArchivo } from '@/modules/reporting/infrastructure/exportadores/comun'
import { construirExcelPartes } from '@/modules/reporting/infrastructure/exportadores/excel'
import { construirPdfPartes } from '@/modules/reporting/infrastructure/exportadores/pdf'

export const dynamic = 'force-dynamic'

const SEPARADOR = ';'

const FORMATOS = ['csv', 'xlsx', 'pdf'] as const
const ESTADOS = ['BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'BLOQUEADO'] as const

const parametros = z.object({
  formato: z.enum(FORMATOS).default('csv'),
  y: z.coerce.number().int().min(2000).max(2100).optional(),
  w: z.coerce.number().int().min(1).max(53).optional(),
  estado: z.enum(ESTADOS).optional(),
  proyecto: z.uuid().optional(),
})

const TIPOS: Record<(typeof FORMATOS)[number], string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
}

function celda(valor: string | number): string {
  const texto = String(valor)
  if (texto.includes(SEPARADOR) || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

export async function GET(request: Request) {
  const usuario = await requireRol('ENCARGADO', 'ADMIN')
  const url = new URL(request.url)

  const lectura = parametros.safeParse(Object.fromEntries(url.searchParams))
  if (!lectura.success) {
    return NextResponse.json({ error: 'Parámetros de exportación no válidos' }, { status: 400 })
  }
  const { formato, y, w, estado, proyecto } = lectura.data

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaHoy = semanaIsoDe(hoy)
  const semana = (() => {
    try {
      return semanaIso(y ?? semanaHoy.isoYear, w ?? semanaHoy.isoWeek)
    } catch {
      return semanaHoy
    }
  })()

  const datos = await datosPartes(usuario, semana, { estado, proyectoId: proyecto })
  const base = `partes-${semana.isoYear}-W${String(semana.isoWeek).padStart(2, '0')}`
  const cabeceras = {
    'Content-Type': TIPOS[formato],
    'Content-Disposition': `attachment; filename="${nombreArchivo(base, formato)}"`,
    'Cache-Control': 'no-store',
  }

  if (formato === 'xlsx') {
    return new NextResponse(new Uint8Array(await construirExcelPartes(datos)), { headers: cabeceras })
  }

  if (formato === 'pdf') {
    return new NextResponse(new Uint8Array(await construirPdfPartes(datos)), { headers: cabeceras })
  }

  const filas = datos.lineas.map((linea) =>
    [
      celda(linea.empleadoNombre),
      celda(linea.empleadoCodigo),
      celda(linea.proyectoNombre),
      celda(linea.proyectoCodigo),
      celda(linea.tareaNombre),
      celda(linea.fecha),
      celda(minutosAHorasDecimal(linea.minutos)),
      celda(linea.minutos),
      celda(linea.estado),
      celda(linea.isoWeek),
      celda(linea.isoYear),
    ].join(SEPARADOR),
  )

  const cabecera = [
    'Empleado',
    'Codigo empleado',
    'Proyecto',
    'Codigo proyecto',
    'Tarea',
    'Fecha',
    'Horas',
    'Minutos',
    'Estado parte',
    'Semana',
    'Año',
  ]

  return new NextResponse(`\uFEFF${[cabecera.join(SEPARADOR), ...filas].join('\r\n')}\r\n`, { headers: cabeceras })
}
