import { NextResponse } from 'next/server'
import { requireRol } from '@/modules/identidad/application/sesion'
import { proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { hoyEnZona, semanaIsoDe, semanaIso } from '@/modules/partes/domain/fechas'
import { minutosAHorasDecimal } from '@/modules/partes/domain/horas'
import { lineasParaExportar } from '@/modules/reporting/infrastructure/consultas'

export const dynamic = 'force-dynamic'

const SEPARADOR = ';'

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

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaHoy = semanaIsoDe(hoy)

  const anio = Number(url.searchParams.get('y') ?? semanaHoy.isoYear)
  const numeroSemana = Number(url.searchParams.get('w') ?? semanaHoy.isoWeek)

  let semana
  try {
    semana = semanaIso(anio, numeroSemana)
  } catch {
    semana = semanaHoy
  }

  const estado = url.searchParams.get('estado') ?? undefined
  const proyectoId = url.searchParams.get('proyecto') ?? undefined
  const permitidos = await proyectosPermitidos(usuario)

  const lineas = await lineasParaExportar(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos, {
    estado,
    proyectoId,
  })

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

  const filas = lineas.map((linea) =>
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

  const contenido = `\uFEFF${[cabecera.join(SEPARADOR), ...filas].join('\r\n')}\r\n`
  const nombre = `partes-${semana.isoYear}-W${String(semana.isoWeek).padStart(2, '0')}.csv`

  return new NextResponse(contenido, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  })
}
