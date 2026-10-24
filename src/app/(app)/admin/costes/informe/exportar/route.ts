import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRol } from '@/modules/identidad/application/sesion'
import { depsCoste } from '@/composition'
import { informeCoste } from '@/modules/coste/application/servicio'
import { hoyEnZona } from '@/modules/partes/domain/fechas'
import { minutosAHorasDecimal } from '@/modules/partes/domain/horas'
import type { FechaIso } from '@/modules/partes/domain/fechas'

export const dynamic = 'force-dynamic'

const SEPARADOR = ';'
const FECHA = /^\d{4}-\d{2}-\d{2}$/

const parametros = z.object({
  desde: z.string().regex(FECHA),
  hasta: z.string().regex(FECHA),
  proyecto: z.uuid().optional(),
})

function celda(valor: string | number): string {
  const texto = String(valor)
  if (texto.includes(SEPARADOR) || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

function euros(cents: number | null): string {
  if (cents === null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

export async function GET(request: Request) {
  const usuario = await requireRol('ADMIN')
  const url = new URL(request.url)

  const lectura = parametros.safeParse(Object.fromEntries(url.searchParams))
  if (!lectura.success) {
    return NextResponse.json({ error: 'Parámetros del informe no válidos' }, { status: 400 })
  }

  const { desde, hasta, proyecto } = lectura.data

  let informe
  try {
    informe = await informeCoste(
      depsCoste,
      usuario,
      { desde: desde as FechaIso, hasta: hasta as FechaIso, proyectoId: proyecto ?? null },
      null,
    )
  } catch {
    return NextResponse.json({ error: 'Rango de fechas no válido' }, { status: 400 })
  }

  const filas = informe.lineas.map((linea) =>
    [
      celda(linea.fecha),
      celda(linea.empleadoNombre),
      celda(linea.empleadoCodigo),
      celda(linea.proyectoNombre),
      celda(linea.proyectoCodigo),
      celda(linea.tareaNombre),
      celda(linea.tareaCodigo),
      celda(linea.minutos),
      celda(minutosAHorasDecimal(linea.minutos)),
      celda(euros(linea.costeHoraCents)),
      celda(euros(linea.importeCents)),
      celda(linea.sinTarifa ? 'SÍ' : 'NO'),
    ].join(SEPARADOR),
  )

  const cabecera = [
    'Fecha',
    'Empleado',
    'Codigo empleado',
    'Proyecto',
    'Codigo proyecto',
    'Tarea',
    'Codigo tarea',
    'Minutos',
    'Horas',
    'Coste hora (EUR)',
    'Importe (EUR)',
    'Sin tarifa',
  ]

  const nombre = `coste-real-${desde}-a-${hasta}.csv`
  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')

  return new NextResponse(`\uFEFF${[cabecera.join(SEPARADOR), ...filas].join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
      'X-Generado-El': hoy,
    },
  })
}
