import { NextResponse } from 'next/server'
import { requireUsuario } from '@/modules/identidad/application/sesion'
import { proyectosDeParte, proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { obtenerParteDetalle } from '@/modules/partes/infrastructure/consultas-detalle'
import { datosParte } from '@/modules/reporting/application/exportacion'
import { nombreEmpresa } from '@/modules/reporting/infrastructure/consultas'
import { nombreArchivo } from '@/modules/reporting/infrastructure/exportadores/comun'
import { construirPdfParte } from '@/modules/reporting/infrastructure/exportadores/pdf'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Props) {
  const usuario = await requireUsuario()
  const { id } = await params

  const parte = await obtenerParteDetalle(id)
  if (!parte) {
    return NextResponse.json({ error: 'Parte no encontrado' }, { status: 404 })
  }

  const esPropietario = usuario.empleadoId === parte.empleadoId
  const esAdmin = usuario.rol === 'ADMIN'
  const esEncargado = usuario.rol === 'ENCARGADO'

  if (!esPropietario && !esAdmin) {
    if (!esEncargado) {
      return NextResponse.json({ error: 'No tienes acceso a este parte' }, { status: 403 })
    }
    const permitidos = await proyectosPermitidos(usuario)
    const delParte = await proyectosDeParte(parte.id)
    if (permitidos !== null && !delParte.some((proyectoId) => permitidos.includes(proyectoId))) {
      return NextResponse.json({ error: 'No tienes acceso a este parte' }, { status: 403 })
    }
  }

  const empresa = await nombreEmpresa(usuario.empresaId)
  const contenido = await construirPdfParte(datosParte(empresa, parte))
  const base = `parte-${parte.empleadoCodigo}-${parte.isoYear}-W${String(parte.isoWeek).padStart(2, '0')}`

  return new NextResponse(new Uint8Array(contenido), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo(base, 'pdf')}"`,
      'Cache-Control': 'no-store',
    },
  })
}
