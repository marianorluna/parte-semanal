import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { depsAusencias } from '@/composition'
import { listarPendientes, listarTodas } from '@/modules/ausencias/application/servicio'
import { ETIQUETAS_ESTADO_AUSENCIA } from '@/modules/ausencias/domain/ausencia'
import { formatearFecha } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { AccionesAusencia } from './AccionesAusencia'

export const dynamic = 'force-dynamic'

export default async function ControlAusenciasPage() {
  const usuario = await requireRol('ENCARGADO', 'ADMIN')
  const [pendientes, todas] = await Promise.all([
    listarPendientes(depsAusencias, usuario),
    listarTodas(depsAusencias, usuario),
  ])
  const resueltas = todas.filter((ausencia) => ausencia.estado !== 'SOLICITADA').slice(0, 30)

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Ausencias del equipo</h1>
        <p className="text-sm text-slate-600">
          Al aprobar una ausencia de jornada completa, esos días quedan bloqueados en la rejilla del
          trabajador con el motivo visible.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Pendientes ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <p className="tarjeta p-4 text-sm text-slate-600">No hay solicitudes pendientes.</p>
        ) : (
          <ul className="space-y-3">
            {pendientes.map((ausencia) => (
              <li key={ausencia.id} className="tarjeta p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">
                      {ausencia.empleadoNombre}{' '}
                      <span className="text-xs font-normal text-slate-500">{ausencia.empleadoCodigo}</span>
                    </p>
                    <p className="text-sm text-slate-700">{ausencia.tipoNombre}</p>
                    <p className="text-xs text-slate-600">
                      {ausencia.desde === ausencia.hasta
                        ? formatearFecha(ausencia.desde)
                        : `${formatearFecha(ausencia.desde)} a ${formatearFecha(ausencia.hasta)}`}
                      {ausencia.minutos !== null
                        ? ` · ${formatearHorasReloj(ausencia.minutos)} por día`
                        : ' · Jornada completa'}
                    </p>
                    {ausencia.motivoSolicitud ? (
                      <p className="mt-1 text-xs text-slate-500">{ausencia.motivoSolicitud}</p>
                    ) : null}
                  </div>
                  <span className="etiqueta bg-amber-100 text-amber-800">Solicitada</span>
                </div>
                <AccionesAusencia ausenciaId={ausencia.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Últimas resueltas</h2>
        {resueltas.length === 0 ? (
          <p className="tarjeta p-4 text-sm text-slate-600">Todavía no hay resoluciones.</p>
        ) : (
          <div className="tarjeta hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
                  <th className="px-3 py-2">Empleado</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Fechas</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Resuelto por</th>
                </tr>
              </thead>
              <tbody>
                {resueltas.map((ausencia) => (
                  <tr key={ausencia.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-800">{ausencia.empleadoNombre}</td>
                    <td className="px-3 py-2 text-slate-700">{ausencia.tipoNombre}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatearFecha(ausencia.desde)}
                      {ausencia.desde === ausencia.hasta ? '' : ` - ${formatearFecha(ausencia.hasta)}`}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {ETIQUETAS_ESTADO_AUSENCIA[ausencia.estado]}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{ausencia.resueltoPorNombre ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Puedes revisar el detalle de cada parte en{' '}
          <Link href="/control/partes" className="font-medium text-marca-700 hover:underline">
            la bandeja de partes
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
