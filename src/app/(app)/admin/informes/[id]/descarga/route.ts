import { NextResponse } from 'next/server'
import { requireRol } from '@/modules/identidad/application/sesion'
import { depsInformes } from '@/composition'
import { descargarInforme } from '@/modules/informes/application/servicio'
import { AppError } from '@/shared/errors'

export const dynamic = 'force-dynamic'

function nombreSeguro(nombre: string): string {
  return nombre.replace(/[^\w.-]+/g, '-')
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const usuario = await requireRol('ADMIN')
  const { id } = await context.params
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const secreto = process.env.AUTH_SECRET ?? ''

  try {
    const { nombreArchivo, contenido } = await descargarInforme(
      depsInformes,
      usuario,
      id,
      token,
      secreto,
    )

    return new NextResponse(new Uint8Array(contenido), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${nombreSeguro(nombreArchivo)}"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
        'Content-Length': String(contenido.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[informes] error de descarga', error)
    return NextResponse.json({ error: 'No se pudo descargar el informe' }, { status: 500 })
  }
}
