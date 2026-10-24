import Link from 'next/link'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { CLASES_RIESGO, type NivelRiesgo } from '@/modules/reporting/domain/riesgo'
import type { ProyectoConRiesgo } from '@/modules/reporting/application/panel'

export function RiesgoBadge({ nivel, etiqueta }: { nivel: NivelRiesgo; etiqueta: string }) {
  return <span className={`etiqueta ${CLASES_RIESGO[nivel]}`}>{etiqueta}</span>
}

function porcentaje(valor: number | null): string {
  return valor === null ? '—' : `${valor}%`
}

function desviacion(valor: number | null): string {
  if (valor === null) return '—'
  return `${valor > 0 ? '+' : ''}${valor} pp`
}

/**
 * Tabla de presupuesto y plazo por proyecto. Se reutiliza en el dashboard y en
 * el listado de proyectos para que el semáforo se lea igual en todas partes.
 */
export function TablaRiesgo({ filas }: { filas: ProyectoConRiesgo[] }) {
  if (filas.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">Sin proyectos con datos todavía.</p>
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
              <th className="px-3 py-2">Proyecto</th>
              <th className="px-3 py-2 text-right">Presupuesto</th>
              <th className="px-3 py-2 text-right">Consumido</th>
              <th className="px-3 py-2 text-right">Consumo</th>
              <th className="px-3 py-2 text-right">Plazo</th>
              <th className="px-3 py-2 text-right">Desviación</th>
              <th className="px-3 py-2 text-right">Proyección</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.proyectoId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/control/proyectos/${fila.proyectoId}`} className="block hover:text-marca-700">
                    <span className="block font-medium text-slate-900">
                      {fila.codigo} · {fila.nombre}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {fila.activo ? 'Activo' : 'Inactivo'}
                      {fila.riesgo.diasTranscurridos !== null && fila.riesgo.diasTotales !== null
                        ? ` · día ${fila.riesgo.diasTranscurridos} de ${fila.riesgo.diasTotales}`
                        : ''}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-600">
                  {fila.horasPresupuesto ? `${fila.horasPresupuesto} h` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-800">{formatearHorasReloj(fila.minutos)}</td>
                <td className="px-3 py-2 text-right">{porcentaje(fila.riesgo.consumoPct)}</td>
                <td className="px-3 py-2 text-right">{porcentaje(fila.riesgo.plazoPct)}</td>
                <td
                  className={`px-3 py-2 text-right ${
                    (fila.riesgo.desviacionPp ?? 0) >= 10 ? 'font-semibold text-orange-700' : 'text-slate-600'
                  }`}
                >
                  {desviacion(fila.riesgo.desviacionPp)}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {fila.riesgo.proyeccionPct === null ? '—' : `${fila.riesgo.proyeccionPct}%`}
                </td>
                <td className="px-3 py-2">
                  <RiesgoBadge nivel={fila.riesgo.nivel} etiqueta={fila.riesgo.etiqueta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {filas.map((fila) => (
          <li key={fila.proyectoId} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/control/proyectos/${fila.proyectoId}`} className="min-w-0 hover:text-marca-700">
                <span className="block truncate font-medium text-slate-900">
                  {fila.codigo} · {fila.nombre}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {fila.activo ? 'Activo' : 'Inactivo'}
                  {fila.riesgo.diasTranscurridos !== null && fila.riesgo.diasTotales !== null
                    ? ` · día ${fila.riesgo.diasTranscurridos} de ${fila.riesgo.diasTotales}`
                    : ''}
                </span>
              </Link>
              <RiesgoBadge nivel={fila.riesgo.nivel} etiqueta={fila.riesgo.etiqueta} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-500">Presupuesto</dt>
                <dd className="font-mono text-slate-800">
                  {fila.horasPresupuesto ? `${fila.horasPresupuesto} h` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Consumido</dt>
                <dd className="font-mono text-slate-800">{formatearHorasReloj(fila.minutos)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Consumo</dt>
                <dd className="text-slate-800">{porcentaje(fila.riesgo.consumoPct)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Plazo</dt>
                <dd className="text-slate-800">{porcentaje(fila.riesgo.plazoPct)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Desviación</dt>
                <dd
                  className={
                    (fila.riesgo.desviacionPp ?? 0) >= 10 ? 'font-semibold text-orange-700' : 'text-slate-800'
                  }
                >
                  {desviacion(fila.riesgo.desviacionPp)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Proyección</dt>
                <dd className="text-slate-800">
                  {fila.riesgo.proyeccionPct === null ? '—' : `${fila.riesgo.proyeccionPct}%`}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
