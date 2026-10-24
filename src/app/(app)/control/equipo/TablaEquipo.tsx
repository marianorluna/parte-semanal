import Link from 'next/link'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import {
  CLASES_CUMPLIMIENTO,
  ETIQUETAS_CUMPLIMIENTO,
  requiereAccionDelTrabajador,
  type EstadoCumplimiento,
} from '@/modules/reporting/domain/cumplimiento'
import { BotonAprobar, BotonRecordar } from './AccionesEquipo'

export type FilaEquipo = {
  empleadoId: string
  usuarioId: string
  nombre: string
  email: string
  codigo: string
  rol: string
  proyectos: string[]
  estado: EstadoCumplimiento
  parteId: string | null
  version: number | null
  minutos: number
}

function EtiquetaRol({ rol }: { rol: string }) {
  if (rol === 'TRABAJADOR') return null
  return <>{` · ${rol === 'ADMIN' ? 'Administrador' : 'Encargado'}`}</>
}

export function TablaEquipo({
  filas,
  isoYear,
  isoWeek,
}: {
  filas: FilaEquipo[]
  isoYear: number
  isoWeek: number
}) {
  if (filas.length === 0) {
    return (
      <div className="tarjeta p-10 text-center">
        <p className="text-sm text-slate-600">No hay personas que coincidan con el filtro.</p>
      </div>
    )
  }

  return (
    <>
      <div className="tarjeta hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2">Proyectos</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Horas</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.empleadoId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <span className="block font-medium text-slate-900">{fila.nombre}</span>
                  <span className="block text-xs text-slate-500">
                    {fila.codigo}
                    <EtiquetaRol rol={fila.rol} />
                  </span>
                </td>
                <td className="max-w-64 px-3 py-2 text-xs text-slate-600">
                  {fila.proyectos.length > 0 ? fila.proyectos.join(', ') : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`etiqueta ${CLASES_CUMPLIMIENTO[fila.estado]}`}>
                    {ETIQUETAS_CUMPLIMIENTO[fila.estado]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {fila.minutos > 0 ? formatearHorasReloj(fila.minutos) : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {fila.parteId ? (
                      <Link href={`/control/partes/${fila.parteId}`} className="boton-secundario px-2.5 py-1 text-xs">
                        Ver parte
                      </Link>
                    ) : null}
                    {fila.estado === 'ENVIADO' && fila.parteId && fila.version !== null ? (
                      <BotonAprobar
                        parteId={fila.parteId}
                        version={fila.version}
                        isoYear={isoYear}
                        isoWeek={isoWeek}
                      />
                    ) : null}
                    {requiereAccionDelTrabajador(fila.estado) ? (
                      <BotonRecordar usuarioId={fila.usuarioId} isoYear={isoYear} isoWeek={isoWeek} />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {filas.map((fila) => (
          <li key={fila.empleadoId} className="tarjeta p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{fila.nombre}</p>
                <p className="text-xs text-slate-500">
                  {fila.codigo}
                  <EtiquetaRol rol={fila.rol} />
                </p>
              </div>
              <span className={`etiqueta shrink-0 ${CLASES_CUMPLIMIENTO[fila.estado]}`}>
                {ETIQUETAS_CUMPLIMIENTO[fila.estado]}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-500">Horas</dt>
                <dd className="font-mono text-slate-800">
                  {fila.minutos > 0 ? formatearHorasReloj(fila.minutos) : '—'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-slate-500">Proyectos</dt>
                <dd className="truncate text-slate-800">
                  {fila.proyectos.length > 0 ? fila.proyectos.join(', ') : '—'}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              {fila.parteId ? (
                <Link
                  href={`/control/partes/${fila.parteId}`}
                  className="boton-secundario flex-1 px-2.5 py-1.5 text-xs"
                >
                  Ver parte
                </Link>
              ) : null}
              {fila.estado === 'ENVIADO' && fila.parteId && fila.version !== null ? (
                <BotonAprobar parteId={fila.parteId} version={fila.version} isoYear={isoYear} isoWeek={isoWeek} />
              ) : null}
              {requiereAccionDelTrabajador(fila.estado) ? (
                <BotonRecordar usuarioId={fila.usuarioId} isoYear={isoYear} isoWeek={isoWeek} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
