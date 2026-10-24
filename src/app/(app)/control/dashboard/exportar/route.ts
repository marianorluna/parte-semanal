import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRol } from '@/modules/identidad/application/sesion'
import { hoyEnZona, semanaIso, semanaIsoDe } from '@/modules/partes/domain/fechas'
import { datosDashboard } from '@/modules/reporting/application/exportacion'
import { nombreArchivo } from '@/modules/reporting/infrastructure/exportadores/comun'
import { construirExcelDashboard } from '@/modules/reporting/infrastructure/exportadores/excel'
import { construirPdfDashboard } from '@/modules/reporting/infrastructure/exportadores/pdf'

export const dynamic = 'force-dynamic'

const FORMATOS = ['xlsx', 'pdf'] as const

const parametros = z.object({
  formato: z.enum(FORMATOS).default('xlsx'),
  y: z.coerce.number().int().min(2000).max(2100).optional(),
  w: z.coerce.number().int().min(1).max(53).optional(),
})

const TIPOS: Record<(typeof FORMATOS)[number], string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
}

export async function GET(request: Request) {
  const usuario = await requireRol('ENCARGADO', 'ADMIN')
  const url = new URL(request.url)

  const lectura = parametros.safeParse(Object.fromEntries(url.searchParams))
  if (!lectura.success) {
    return NextResponse.json({ error: 'Parámetros de exportación no válidos' }, { status: 400 })
  }
  const { formato, y, w } = lectura.data

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaHoy = semanaIsoDe(hoy)
  const semana = (() => {
    try {
      return semanaIso(y ?? semanaHoy.isoYear, w ?? semanaHoy.isoWeek)
    } catch {
      return semanaHoy
    }
  })()

  const datos = await datosDashboard(usuario, semana, hoy)
  const base = `dashboard-${semana.isoYear}-W${String(semana.isoWeek).padStart(2, '0')}`

  const contenido =
    formato === 'pdf' ? await construirPdfDashboard(datos) : await construirExcelDashboard(datos)

  return new NextResponse(new Uint8Array(contenido), {
    headers: {
      'Content-Type': TIPOS[formato],
      'Content-Disposition': `attachment; filename="${nombreArchivo(base, formato)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
