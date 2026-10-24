import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRol } from '@/modules/identidad/application/sesion'
import { proyectosDeParte, proyectosPermitidos, rolDeEmpleado } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { formatearFecha, nombreDia, formatearRango } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { puedeRevisarParte } from '@/modules/partes/domain/permisos'
import { historialParte, obtenerParteDetalle } from '@/modules/partes/infrastructure/consultas-detalle'
import { EstadoBadge } from '@/components/EstadoBadge'
import { AccionesRevision } from './AccionesRevision'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function ParteDetallePage({ params }: Props) {
  const usuario = await requireRol('ENCARGADO', 'ADMIN')
  const { id } = await params

  const parte = await obtenerParteDetalle(id)
  if (!parte) notFound()

  if (usuario.rol !== 'ADMIN') {
    // El encargado no revisa sus propias horas ni las de otro encargado o admin.
    const rolEmpleado = await rolDeEmpleado(parte.empleadoId)
    if (!puedeRevisarParte(usuario.rol, rolEmpleado)) notFound()

    const permitidos = await proyectosPermitidos(usuario)
    const delParte = await proyectosDeParte(parte.id)
    const autorizado = permitidos === null || delParte.some((p) => permitidos.includes(p))
    if (!autorizado) notFound()
  }

  const eventos = await historialParte(parte.id)

  const porFecha = new Map<string, typeof parte.imputaciones>()
  for (const linea of parte.imputaciones) {
    const lista = porFecha.get(linea.fecha) ?? []
    lista.push(linea)
    porFecha.set(linea.fecha, lista)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/control/partes" className="text-xs font-medium text-marca-700 hover:underline">
            Volver a la bandeja
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{parte.empleadoNombre}</h1>
          <p className="text-sm text-slate-600">
            {parte.empleadoCodigo} · semana {parte.isoWeek} de {parte.isoYear} ·{' '}
            {formatearRango(parte.weekStart, addDays(parte.weekStart, 6))}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <EstadoBadge estado={parte.estado} />
          <p className="text-2xl font-bold text-slate-900">{formatearHorasReloj(parte.totalMinutos)}</p>
          <div className="flex items-center gap-3">
            <Link href={`/partes/${parte.id}/imprimir`} className="text-xs font-medium text-marca-700 hover:underline">
              Ver versión imprimible
            </Link>
            <a href={`/partes/${parte.id}/pdf`} className="text-xs font-medium text-marca-700 hover:underline">
              Descargar PDF
            </a>
          </div>
        </div>
      </div>

      {parte.motivoRechazo ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Motivo del rechazo:</strong> {parte.motivoRechazo}
        </p>
      ) : null}

      <div className="tarjeta overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Proyecto</th>
              <th className="px-3 py-2">Tarea</th>
              <th className="px-3 py-2 text-right">Horas</th>
            </tr>
          </thead>
          <tbody>
            {[...porFecha.entries()].map(([fecha, lineas]) => (
              <FragmentoFecha key={fecha} fecha={fecha} lineas={lineas} />
            ))}
            <tr className="border-t-2 border-slate-300 bg-marca-50 font-semibold">
              <td className="px-3 py-2" colSpan={3}>
                Total semana
              </td>
              <td className="px-3 py-2 text-right">{formatearHorasReloj(parte.totalMinutos)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="tarjeta p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Revisión</h2>
          <AccionesRevision parteId={parte.id} version={parte.version} estado={parte.estado} />
          <dl className="mt-4 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between gap-2">
              <dt>Enviado</dt>
              <dd>{parte.enviadoAt ? formatearInstante(parte.enviadoAt) : 'Sin enviar'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Revisado por</dt>
              <dd>{parte.revisorNombre ?? 'Pendiente'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Última revisión</dt>
              <dd>{parte.revisadoAt ? formatearInstante(parte.revisadoAt) : 'Pendiente'}</dd>
            </div>
          </dl>
        </div>

        <div className="tarjeta p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial</h2>
          {eventos.length === 0 ? (
            <p className="text-xs text-slate-500">Sin eventos registrados.</p>
          ) : (
            <ol className="space-y-2 text-xs">
              {eventos.map((evento) => (
                <li key={evento.id} className="border-l-2 border-slate-200 pl-3">
                  <p className="font-medium text-slate-800">{etiquetaAccion(evento.accion)}</p>
                  <p className="text-slate-500">
                    {formatearInstante(evento.createdAt)} · {evento.actorNombre ?? 'Sistema'}
                  </p>
                  {evento.motivo ? <p className="mt-0.5 text-slate-600">{evento.motivo}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}

function FragmentoFecha({
  fecha,
  lineas,
}: {
  fecha: string
  lineas: { id: string; minutos: number; proyectoCodigo: string; proyectoNombre: string; tareaCodigo: string; tareaNombre: string; nota: string | null }[]
}) {
  const total = lineas.reduce((suma, linea) => suma + linea.minutos, 0)

  return (
    <>
      {lineas.map((linea, indice) => (
        <tr key={linea.id} className="border-b border-slate-100 last:border-0">
          <td className="px-3 py-2 align-top whitespace-nowrap">
            {indice === 0 ? (
              <>
                <span className="block font-medium text-slate-800 capitalize">{nombreDia(fecha)}</span>
                <span className="block text-xs text-slate-500">{formatearFecha(fecha)}</span>
                <span className="block text-xs text-slate-500">{formatearHorasReloj(total)}</span>
              </>
            ) : null}
          </td>
          <td className="px-3 py-2">
            <span className="block text-xs text-slate-500">{linea.proyectoCodigo}</span>
            <span className="text-slate-800">{linea.proyectoNombre}</span>
          </td>
          <td className="px-3 py-2 text-slate-800">{linea.tareaNombre}</td>
          <td className="px-3 py-2 text-right font-mono">{formatearHorasReloj(linea.minutos)}</td>
        </tr>
      ))}
    </>
  )
}

function addDays(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T00:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() + dias)
  return base.toISOString().slice(0, 10)
}

function formatearInstante(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor)
}

function etiquetaAccion(accion: string): string {
  const etiquetas: Record<string, string> = {
    ENVIAR_PARTE: 'Parte enviado',
    APROBAR_PARTE: 'Parte aprobado',
    RECHAZAR_PARTE: 'Parte rechazado',
    REABRIR_PARTE: 'Parte reabierto',
  }
  return etiquetas[accion] ?? accion
}
