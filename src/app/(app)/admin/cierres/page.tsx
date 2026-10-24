import { requireRol } from '@/modules/identidad/application/sesion'
import { listarEmpleadosDeEmpresa } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsCierre } from '@/composition'
import { listarPeriodos } from '@/modules/cierre/application/servicio'
import { etiquetaPeriodo } from '@/modules/cierre/domain/cierre'
import { formatearRango, hoyEnZona, semanaIsoDe } from '@/modules/partes/domain/fechas'
import {
  BotonReabrirPeriodo,
  FormularioCierreMensual,
  FormularioCierreSemanal,
} from './FormulariosCierre'

export const dynamic = 'force-dynamic'

function ambito(periodo: {
  empleadoId: string | null
  empleadoCodigo: string | null
  empleadoNombre: string | null
}): string {
  if (!periodo.empleadoId) return 'Toda la empresa'
  return `${periodo.empleadoCodigo ?? ''} · ${periodo.empleadoNombre ?? ''}`.trim()
}

export default async function AdminCierresPage() {
  const usuario = await requireRol('ADMIN')
  const [periodos, empleados] = await Promise.all([
    listarPeriodos(depsCierre, usuario),
    listarEmpleadosDeEmpresa(usuario.empresaId),
  ])

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaActual = semanaIsoDe(hoy)
  const anioActual = Number(hoy.slice(0, 4))
  const mesActual = Number(hoy.slice(5, 7))

  const activos = periodos.filter((periodo) => periodo.activo)
  const historial = periodos.filter((periodo) => !periodo.activo)

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Cierres de periodo</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Cerrar un periodo bloquea la escritura de sus fechas: ni siquiera administración puede
          modificar horas sin reabrirlo con motivo. Al reabrir, los partes vuelven a Aprobado y se
          recalculan cómputo y coste.
        </p>
      </div>

      <details className="tarjeta p-4" open>
        <summary className="cursor-pointer text-sm font-semibold text-marca-800">Cierre semanal</summary>
        <div className="mt-4">
          <FormularioCierreSemanal
            empleados={empleados}
            anio={semanaActual.isoYear}
            semana={semanaActual.isoWeek}
          />
        </div>
      </details>

      <details className="tarjeta p-4" open>
        <summary className="cursor-pointer text-sm font-semibold text-marca-800">Cierre mensual</summary>
        <div className="mt-4">
          <FormularioCierreMensual empleados={empleados} anio={anioActual} mes={mesActual} />
        </div>
      </details>

      <article className="tarjeta p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Periodos cerrados vigentes</h2>
        {activos.length === 0 ? (
          <p className="text-sm text-slate-600">No hay periodos cerrados.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activos.map((periodo) => (
              <li key={periodo.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {etiquetaPeriodo(periodo)} · {ambito(periodo)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatearRango(periodo.desde, periodo.hasta)} · {periodo.partesBloqueados}{' '}
                      partes bloqueados
                      {periodo.cerradoPorNombre ? ` · cerrado por ${periodo.cerradoPorNombre}` : ''}
                    </p>
                    {periodo.motivo ? (
                      <p className="text-xs text-slate-500">Motivo: {periodo.motivo}</p>
                    ) : null}
                  </div>
                  <span className="etiqueta bg-marca-900 text-white">
                    {periodo.tipo === 'SEMANAL' ? 'Semanal' : 'Mensual'}
                  </span>
                </div>
                <BotonReabrirPeriodo periodoId={periodo.id} etiqueta={etiquetaPeriodo(periodo)} />
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="tarjeta overflow-x-auto p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial de reaperturas</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-600">Todavía no se ha reabierto ningún periodo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
                <th className="px-3 py-2">Periodo</th>
                <th className="px-3 py-2">Ámbito</th>
                <th className="px-3 py-2">Rango</th>
                <th className="px-3 py-2">Partes</th>
                <th className="px-3 py-2">Reapertura</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((periodo) => (
                <tr key={periodo.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2">
                    <span className="block text-slate-800">{etiquetaPeriodo(periodo)}</span>
                    <span className="text-xs text-slate-500">
                      {periodo.tipo === 'SEMANAL' ? 'Semanal' : 'Mensual'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{ambito(periodo)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {formatearRango(periodo.desde, periodo.hasta)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{periodo.partesBloqueados}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {periodo.reabiertoAt ? periodo.reabiertoAt.toISOString().slice(0, 10) : '-'}
                    {periodo.reabiertoPorNombre ? ` · ${periodo.reabiertoPorNombre}` : ''}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{periodo.motivoReapertura ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  )
}
