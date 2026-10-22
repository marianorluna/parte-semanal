import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarEmpleadosDeEmpresa } from '@/modules/identidad/infrastructure/repositorio-identidad'
import {
  listarAsignacionesDeProyecto,
  listarTareas,
  obtenerProyecto,
} from '@/modules/organizacion/infrastructure/comandos'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { hoyEnZona } from '@/modules/partes/domain/fechas'
import {
  BotonAlternarProyecto,
  BotonDesasignar,
  FormularioAsignacion,
  FormularioTarea,
} from '../FormulariosProyecto'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function AdminProyectoDetallePage({ params }: Props) {
  const usuario = await requireRol('ADMIN')
  const { id } = await params

  const proyecto = await obtenerProyecto(id)
  if (!proyecto || proyecto.empresaId !== usuario.empresaId) notFound()

  const [tareas, asignaciones, empleados] = await Promise.all([
    listarTareas(proyecto.id),
    listarAsignacionesDeProyecto(proyecto.id),
    listarEmpleadosDeEmpresa(usuario.empresaId),
  ])

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/proyectos" className="text-xs font-medium text-marca-700 hover:underline">
            Volver a proyectos
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {proyecto.codigo} · {proyecto.nombre}
          </h1>
          <p className="text-sm text-slate-600">
            {proyecto.horasPresupuesto ? `Presupuesto: ${proyecto.horasPresupuesto} h` : 'Sin presupuesto definido'}
          </p>
        </div>
        <BotonAlternarProyecto proyectoId={proyecto.id} activo={proyecto.activo} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="tarjeta p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Tareas</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                <th className="py-1.5">Código</th>
                <th className="py-1.5">Nombre</th>
                <th className="py-1.5 text-right">Horas</th>
              </tr>
            </thead>
            <tbody>
              {tareas.map((tarea) => (
                <tr key={tarea.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 font-medium text-slate-800">{tarea.codigo}</td>
                  <td className="py-1.5 text-slate-700">{tarea.nombre}</td>
                  <td className="py-1.5 text-right font-mono text-slate-700">{formatearHorasReloj(tarea.minutos)}</td>
                </tr>
              ))}
              {tareas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-xs text-slate-500">
                    Sin tareas todavía
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-600 uppercase">Nueva tarea</h3>
            <FormularioTarea proyectoId={proyecto.id} />
          </div>
        </div>

        <div className="tarjeta p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Asignaciones</h2>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 uppercase">
                  <th className="py-1.5">Empleado</th>
                  <th className="py-1.5">Tarea</th>
                  <th className="py-1.5">Desde</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((asignacion) => (
                  <tr key={asignacion.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5">
                      <span className="block text-slate-800">{asignacion.empleadoNombre}</span>
                      <span className="block text-slate-500">{asignacion.empleadoCodigo}</span>
                    </td>
                    <td className="py-1.5">
                      <span className="block text-slate-800">{asignacion.tareaNombre}</span>
                      <span className="block text-slate-500">{asignacion.tareaCodigo}</span>
                    </td>
                    <td className="py-1.5 text-slate-600">{asignacion.desde}</td>
                    <td className="py-1.5 text-right">
                      {asignacion.activa ? (
                        <BotonDesasignar asignacionId={asignacion.id} proyectoId={proyecto.id} />
                      ) : (
                        <span className="text-slate-400">finalizada</span>
                      )}
                    </td>
                  </tr>
                ))}
                {asignaciones.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-slate-500">
                      Sin asignaciones
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-600 uppercase">Nueva asignación</h3>
            <FormularioAsignacion proyectoId={proyecto.id} empleados={empleados} tareas={tareas} hoy={hoy} />
          </div>
        </div>
      </div>
    </section>
  )
}
