import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import {
  listarEmpleadosDeEmpresa,
  listarProyectos,
} from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsCoste } from '@/composition'
import {
  ejecucionPresupuestaria,
  listarPresupuestos,
  listarTarifas,
} from '@/modules/coste/application/servicio'
import { formatearEuros } from '@/modules/coste/domain/coste'
import { hoyEnZona } from '@/modules/partes/domain/fechas'
import {
  BotonEliminarTarifa,
  FormularioEdicionTarifa,
  FormularioPresupuesto,
  FormularioTarifa,
} from './FormulariosCoste'

export const dynamic = 'force-dynamic'

function ambito(tarifa: {
  empleadoId: string | null
  empleadoNombre: string | null
  empleadoCodigo: string | null
  categoria: string | null
}): string {
  if (tarifa.empleadoId) return `${tarifa.empleadoCodigo} · ${tarifa.empleadoNombre}`
  return tarifa.categoria ?? 'Sin ámbito'
}

export default async function AdminCostesPage() {
  const usuario = await requireRol('ADMIN')
  const [tarifas, presupuestos, ejecucion, empleados, proyectos] = await Promise.all([
    listarTarifas(depsCoste, usuario),
    listarPresupuestos(depsCoste, usuario),
    ejecucionPresupuestaria(depsCoste, usuario, null),
    listarEmpleadosDeEmpresa(usuario.empresaId),
    listarProyectos(usuario.empresaId),
  ])
  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')

  const porProyecto = new Map<string, typeof presupuestos>()
  for (const presupuesto of presupuestos) {
    const lista = porProyecto.get(presupuesto.proyectoId) ?? []
    lista.push(presupuesto)
    porProyecto.set(presupuesto.proyectoId, lista)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Coste hora y presupuestos</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Importes en céntimos enteros. El coste se congela al aprobar cada parte con la
            tarifa vigente a la fecha imputada; cambiar una tarifa después no altera semanas
            cerradas. Una imputación sin tarifa genera aviso, no error.
          </p>
        </div>
        <Link href="/admin/costes/informe" className="boton-secundario">
          Informe de coste real
        </Link>
      </div>

      <details className="tarjeta p-4" open>
        <summary className="cursor-pointer text-sm font-semibold text-marca-800">Tarifas</summary>
        <div className="mt-4 space-y-4">
          <FormularioTarifa empleados={empleados} hoy={hoy} />

          {tarifas.length === 0 ? (
            <p className="text-xs text-slate-500">
              Sin tarifas: los partes se aprueban igual, pero el coste queda a 0 y se avisa en el
              informe.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tarifas.map((tarifa) => (
                <li key={tarifa.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{ambito(tarifa)}</p>
                      <p className="text-xs text-slate-500">
                        {tarifa.desde} - {tarifa.hasta ?? 'sin fin'} ·{' '}
                        {formatearEuros(tarifa.importeHoraCents)}/hora
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`etiqueta ${tarifa.activo ? 'bg-acento-100 text-acento-800' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {tarifa.activo ? 'Activa' : 'Inactiva'}
                      </span>
                      <BotonEliminarTarifa tarifaId={tarifa.id} />
                    </div>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-marca-800">
                      Editar tarifa
                    </summary>
                    <div className="mt-3">
                      <FormularioEdicionTarifa
                        empleados={empleados}
                        hoy={hoy}
                        tarifa={{
                          id: tarifa.id,
                          empleadoId: tarifa.empleadoId,
                          categoria: tarifa.categoria,
                          importeHoraCents: tarifa.importeHoraCents,
                          desde: tarifa.desde,
                          hasta: tarifa.hasta,
                          activo: tarifa.activo,
                        }}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <details className="tarjeta p-4" open>
        <summary className="cursor-pointer text-sm font-semibold text-marca-800">
          Presupuesto por proyecto
        </summary>
        <div className="mt-4 space-y-4">
          <FormularioPresupuesto proyectos={proyectos} />

          {proyectos.length === 0 ? (
            <p className="text-xs text-slate-500">No hay proyectos activos.</p>
          ) : (
            <div className="space-y-3">
              {proyectos.map((proyecto) => {
                const versiones = porProyecto.get(proyecto.id) ?? []
                const vigente = versiones[0]
                return (
                  <article key={proyecto.id} className="rounded-md border border-slate-200 p-3">
                    <header className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {proyecto.codigo} · {proyecto.nombre}
                      </span>
                      {vigente ? (
                        <span className="text-xs text-slate-500">
                          Versión {vigente.version} · {formatearEuros(vigente.importeCents)}
                          {vigente.horasPresupuesto !== null
                            ? ` · ${vigente.horasPresupuesto} h`
                            : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700">Sin presupuesto</span>
                      )}
                    </header>

                    {versiones.length > 1 ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-marca-800">
                          Historial de versiones ({versiones.length})
                        </summary>
                        <ul className="mt-2 divide-y divide-slate-100 text-xs text-slate-600">
                          {versiones.map((version) => (
                            <li key={version.id} className="flex flex-wrap justify-between gap-2 py-1">
                              <span>
                                v{version.version} · {formatearEuros(version.importeCents)}
                                {version.horasPresupuesto !== null
                                  ? ` · ${version.horasPresupuesto} h`
                                  : ''}
                                {version.motivo ? ` · ${version.motivo}` : ''}
                              </span>
                              <span>{version.createdAt.toISOString().slice(0, 10)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </details>

      <article className="tarjeta overflow-x-auto p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Ejecución presupuestaria</h2>
        {ejecucion.length === 0 ? (
          <p className="text-sm text-slate-600">Todavía no hay costes aprobados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
                <th className="px-3 py-2">Proyecto</th>
                <th className="px-3 py-2 text-right">Presupuesto</th>
                <th className="px-3 py-2 text-right">Coste real</th>
                <th className="px-3 py-2 text-right">Restante</th>
                <th className="px-3 py-2 text-right">Ejecución</th>
                <th className="px-3 py-2 text-right">Horas</th>
                <th className="px-3 py-2">Avisos</th>
              </tr>
            </thead>
            <tbody>
              {ejecucion.map((fila) => (
                <tr key={fila.proyectoId} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2">
                    <span className="block font-medium text-slate-800">
                      {fila.nombre}
                      {fila.esAjuste ? (
                        <span className="ml-2 etiqueta bg-slate-200 text-slate-600">Ajuste</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-slate-500">{fila.codigo}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {fila.presupuestoCents === null ? '-' : formatearEuros(fila.presupuestoCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatearEuros(fila.gastadoCents)}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${fila.excedido ? 'text-red-700' : 'text-slate-600'}`}
                  >
                    {fila.restanteCents === null ? '-' : formatearEuros(fila.restanteCents)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fila.presupuestoCents === null ? (
                      '-'
                    ) : (
                      <span
                        className={`etiqueta ${fila.excedido ? 'bg-red-100 text-red-800' : 'bg-marca-100 text-marca-800'}`}
                      >
                        {fila.porcentaje.toFixed(1).replace('.', ',')} %
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {fila.horasAprobadas.toFixed(1).replace('.', ',')}
                    {fila.horasPresupuesto !== null ? ` / ${fila.horasPresupuesto}` : ''}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {fila.lineasSinTarifa > 0 ? (
                      <span className="etiqueta bg-amber-100 text-amber-800">
                        {fila.lineasSinTarifa} sin tarifa
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
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
