import { notFound } from 'next/navigation'
import { requireUsuario } from '@/modules/identidad/application/sesion'
import { proyectosDeParte, proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { formatearFecha, nombreDia } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { etiquetaEstado } from '@/modules/partes/domain/parte'
import { obtenerParteDetalle } from '@/modules/partes/infrastructure/consultas-detalle'
import { BotonImprimir } from './BotonImprimir'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function ImprimirPartePage({ params }: Props) {
  const usuario = await requireUsuario()
  const { id } = await params

  const parte = await obtenerParteDetalle(id)
  if (!parte) notFound()

  const esPropietario = usuario.empleadoId === parte.empleadoId
  const esAdmin = usuario.rol === 'ADMIN'
  const esEncargado = usuario.rol === 'ENCARGADO'

  if (!esPropietario && !esAdmin) {
    if (!esEncargado) notFound()
    const permitidos = await proyectosPermitidos(usuario)
    const delParte = await proyectosDeParte(parte.id)
    if (permitidos !== null && !delParte.some((p) => permitidos.includes(p))) notFound()
  }

  const porFecha = new Map<string, typeof parte.imputaciones>()
  for (const linea of parte.imputaciones) {
    const lista = porFecha.get(linea.fecha) ?? []
    lista.push(linea)
    porFecha.set(linea.fecha, lista)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-imprimir mb-4 flex items-center justify-between">
        <a href={`/control/partes/${parte.id}`} className="text-sm text-marca-700 hover:underline">
          Volver al parte
        </a>
        <div className="flex items-center gap-2">
          <a href={`/partes/${parte.id}/pdf`} className="boton-secundario">
            Descargar PDF
          </a>
          <BotonImprimir />
        </div>
      </div>

      <article className="relative overflow-hidden bg-white p-8 ring-1 ring-slate-200">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="rotate-[-30deg] text-6xl font-black tracking-widest text-slate-900/[0.06]">
            {etiquetaEstado(parte.estado).toUpperCase()}
          </span>
        </div>

        <header className="relative border-b border-slate-300 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-marca-800 uppercase">Levitec</p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">Parte semanal de horas</h1>
              <p className="text-sm text-slate-600">
                Semana {parte.isoWeek} de {parte.isoYear}
              </p>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Empleado:</span> {parte.empleadoNombre}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Código:</span> {parte.empleadoCodigo}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Estado:</span> {etiquetaEstado(parte.estado)}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Documento:</span> {parte.id.slice(0, 8)}
              </p>
            </div>
          </div>
        </header>

        <table className="relative mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs tracking-wide text-slate-600 uppercase">
              <th className="py-1.5">Fecha</th>
              <th className="py-1.5">Proyecto</th>
              <th className="py-1.5">Tarea</th>
              <th className="py-1.5 text-right">Horas</th>
            </tr>
          </thead>
          <tbody>
            {[...porFecha.entries()].map(([fecha, lineas]) => {
              const total = lineas.reduce((suma, linea) => suma + linea.minutos, 0)
              return lineas.map((linea, indice) => (
                <tr key={linea.id} className="border-b border-slate-100">
                  <td className="py-1.5 align-top whitespace-nowrap">
                    {indice === 0 ? (
                      <>
                        <span className="block capitalize">{nombreDia(fecha)}</span>
                        <span className="block text-xs text-slate-500">{formatearFecha(fecha)}</span>
                      </>
                    ) : null}
                  </td>
                  <td className="py-1.5">
                    <span className="block text-xs text-slate-500">{linea.proyectoCodigo}</span>
                    {linea.proyectoNombre}
                  </td>
                  <td className="py-1.5">{linea.tareaNombre}</td>
                  <td className="py-1.5 text-right font-mono">
                    {indice === 0 ? formatearHorasReloj(total) : ''}
                  </td>
                </tr>
              ))
            })}
            <tr className="border-t-2 border-slate-400 text-base font-bold">
              <td className="py-3" colSpan={3}>
                Total semana
              </td>
              <td className="py-3 text-right font-mono">{formatearHorasReloj(parte.totalMinutos)}</td>
            </tr>
          </tbody>
        </table>

        <footer className="relative mt-10 grid grid-cols-2 gap-8 text-xs text-slate-600">
          <div>
            <p className="border-t border-slate-400 pt-2">Firma del trabajador</p>
          </div>
          <div>
            <p className="border-t border-slate-400 pt-2">Firma de conformidad</p>
          </div>
        </footer>
      </article>
    </div>
  )
}
