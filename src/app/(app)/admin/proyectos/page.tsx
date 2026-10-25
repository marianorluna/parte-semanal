import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarProyectosConTotales } from '@/modules/organizacion/infrastructure/comandos'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { FormularioProyecto } from './FormulariosProyecto'

export const dynamic = 'force-dynamic'

export default async function AdminProyectosPage() {
  const usuario = await requireRol('ADMIN')
  const proyectos = await listarProyectosConTotales(usuario.empresaId)

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Proyectos y tareas</h1>
        <p className="text-sm text-slate-600">{proyectos.length} proyectos</p>
      </div>

      <details className="tarjeta p-4">
        <summary className="cursor-pointer text-sm font-semibold text-marca-800">Crear proyecto</summary>
        <div className="mt-4">
          <FormularioProyecto />
        </div>
      </details>

      <div className="tarjeta hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2 text-right">Tareas</th>
              <th className="px-3 py-2 text-right">Horas acumuladas</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map((proyecto) => (
              <tr key={proyecto.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">
                  <Link href={`/admin/proyectos/${proyecto.id}`} className="hover:text-marca-700">
                    {proyecto.codigo}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {proyecto.nombre}
                  {proyecto.esAjuste ? (
                    <span className="ml-2 etiqueta bg-slate-200 text-slate-600">Ajuste</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">{proyecto.tareas}</td>
                <td className="px-3 py-2 text-right font-mono">{formatearHorasReloj(proyecto.minutos)}</td>
                <td className="px-3 py-2">
                  <span className={`etiqueta ${proyecto.activo ? 'bg-acento-100 text-acento-800' : 'bg-slate-200 text-slate-600'}`}>
                    {proyecto.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {proyectos.map((proyecto) => (
          <li key={proyecto.id} className="tarjeta p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/admin/proyectos/${proyecto.id}`} className="min-w-0 hover:text-marca-700">
                <span className="mt-0.5 block text-xs font-semibold text-marca-800">{proyecto.codigo}</span>
                <span className="block truncate font-medium text-slate-900">{proyecto.nombre}</span>
                {proyecto.esAjuste ? (
                  <span className="mt-1 inline-block rounded bg-slate-200 px-1 text-[10px] font-semibold text-slate-600">
                    Ajuste
                  </span>
                ) : null}
              </Link>
              <span
                className={`etiqueta shrink-0 ${proyecto.activo ? 'bg-acento-100 text-acento-800' : 'bg-slate-200 text-slate-600'}`}
              >
                {proyecto.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-500">Tareas</dt>
                <dd className="text-slate-800">{proyecto.tareas}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Horas acumuladas</dt>
                <dd className="font-mono text-slate-800">{formatearHorasReloj(proyecto.minutos)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}
