import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarProyectos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsCoste } from '@/composition'
import { informeCoste } from '@/modules/coste/application/servicio'
import { formatearEuros } from '@/modules/coste/domain/coste'
import { hoyEnZona } from '@/modules/partes/domain/fechas'
import { minutosAHorasDecimal } from '@/modules/partes/domain/horas'
import { Select } from '@/components/Select'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ desde?: string; hasta?: string; proyecto?: string }>
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/

export default async function InformeCostePage({ searchParams }: Props) {
  const usuario = await requireRol('ADMIN')
  const params = await searchParams
  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')

  const desde = params.desde && FECHA.test(params.desde) ? params.desde : `${hoy.slice(0, 8)}01`
  const hasta = params.hasta && FECHA.test(params.hasta) ? params.hasta : hoy
  const proyectoId = params.proyecto && params.proyecto !== '' ? params.proyecto : null

  const [proyectos, informe] = await Promise.all([
    listarProyectos(usuario.empresaId),
    informeCoste(depsCoste, usuario, { desde, hasta, proyectoId }, null),
  ])

  const consulta = new URLSearchParams({ desde, hasta })
  if (proyectoId) consulta.set('proyecto', proyectoId)
  const enlaceExportacion = `/admin/costes/informe/exportar?${consulta.toString()}`

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Informe de coste real</h1>
          <p className="text-sm text-slate-600">
            Líneas costeadas al aprobar los partes. La tarifa aplicada es la vigente a la fecha
            imputada, no la actual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/costes" className="boton-secundario">
            Volver
          </Link>
          <a href={enlaceExportacion} className="boton-primario">
            Descargar CSV
          </a>
        </div>
      </div>

      <form
        className="tarjeta flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end"
        action="/admin/costes/informe"
        method="get"
      >
        <label className="text-xs font-medium text-slate-600">
          Desde
          <input name="desde" type="date" defaultValue={desde} className="campo mt-1 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Hasta
          <input name="hasta" type="date" defaultValue={hasta} className="campo mt-1 py-1.5 text-sm" />
        </label>
        <Select
          etiqueta="Proyecto"
          name="proyecto"
          valorInicial={proyectoId ?? ''}
          className="py-1.5 text-sm"
          classNameContenedor="sm:min-w-64"
          opciones={[
            { valor: '', etiqueta: 'Todos' },
            ...proyectos.map((proyecto) => ({
              valor: proyecto.id,
              etiqueta: `${proyecto.codigo} · ${proyecto.nombre}`,
            })),
          ]}
        />
        <button type="submit" className="boton-secundario">
          Aplicar
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="tarjeta p-3">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Coste total</p>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
            {formatearEuros(informe.totalCents)}
          </p>
        </div>
        <div className="tarjeta p-3">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Horas costeadas</p>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
            {minutosAHorasDecimal(informe.minutos)} h
          </p>
        </div>
        <div className="tarjeta p-3">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Líneas sin tarifa</p>
          <p
            className={`mt-1 font-mono text-lg font-semibold ${informe.lineasSinTarifa > 0 ? 'text-amber-700' : 'text-slate-900'}`}
          >
            {informe.lineasSinTarifa}
          </p>
        </div>
      </div>

      <article className="tarjeta overflow-x-auto p-4">
        {informe.lineas.length === 0 ? (
          <p className="text-sm text-slate-600">
            No hay costes en el rango seleccionado. Solo se costean partes aprobados.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Empleado</th>
                <th className="px-3 py-2">Proyecto</th>
                <th className="px-3 py-2">Tarea</th>
                <th className="px-3 py-2 text-right">Horas</th>
                <th className="px-3 py-2 text-right">€/h</th>
                <th className="px-3 py-2 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {informe.lineas.map((linea, indice) => (
                <tr key={`${linea.fecha}-${linea.empleadoCodigo}-${indice}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 text-slate-600">{linea.fecha}</td>
                  <td className="px-3 py-2">
                    <span className="block text-slate-800">{linea.empleadoNombre}</span>
                    <span className="text-xs text-slate-500">{linea.empleadoCodigo}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block text-slate-800">{linea.proyectoNombre}</span>
                    <span className="text-xs text-slate-500">{linea.proyectoCodigo}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block text-slate-800">{linea.tareaNombre}</span>
                    <span className="text-xs text-slate-500">{linea.tareaCodigo}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{minutosAHorasDecimal(linea.minutos)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">
                    {linea.costeHoraCents === null ? '-' : formatearEuros(linea.costeHoraCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatearEuros(linea.importeCents)}
                    {linea.sinTarifa ? (
                      <span className="ml-2 etiqueta bg-amber-100 text-amber-800">Sin tarifa</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  )
}
