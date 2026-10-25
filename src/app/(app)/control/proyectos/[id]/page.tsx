import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRol } from '@/modules/identidad/application/sesion'
import { proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { obtenerProyecto } from '@/modules/organizacion/infrastructure/comandos'
import { hoyEnZona, semanaIsoDe, sumarDias } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { evaluarRiesgo, ritmoAdmisible, CLASES_RIESGO } from '@/modules/reporting/domain/riesgo'
import { detalleTareasProyecto, tendenciaProyecto } from '@/modules/reporting/infrastructure/consultas'
import { TablaRiesgo } from '@/components/TablaRiesgo'
import { GraficoEvolucion } from '@/components/GraficoEvolucion'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function ProyectoDetallePage({ params }: Props) {
  const usuario = await requireRol('ENCARGADO', 'ADMIN')
  const { id } = await params

  const proyecto = await obtenerProyecto(id)
  if (!proyecto || proyecto.empresaId !== usuario.empresaId) notFound()

  const permitidos = await proyectosPermitidos(usuario)
  if (permitidos !== null && !permitidos.includes(proyecto.id)) notFound()

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaActual = semanaIsoDe(hoy)

  const [tareas, tendencia] = await Promise.all([
    detalleTareasProyecto(usuario.empresaId, proyecto.id),
    tendenciaProyecto(proyecto.id, sumarDias(semanaActual.weekStart, -11 * 7)),
  ])

  const minutosConsumidos = tareas.reduce((suma, tarea) => suma + tarea.minutos, 0)
  const riesgo = evaluarRiesgo({
    minutosConsumidos,
    horasPresupuesto: proyecto.horasPresupuesto,
    fechaInicio: proyecto.fechaInicio,
    fechaFin: proyecto.fechaFin,
    hoy,
  })
  const ritmo = ritmoAdmisible(riesgo)
  const maximoTarea = Math.max(...tareas.map((tarea) => tarea.horasPresupuesto ? tarea.horasPresupuesto * 60 : 0), 1)
  const maximoSemana = Math.max(...tendencia.map((fila) => fila.minutos), 1)

  const fila = {
    proyectoId: proyecto.id,
    codigo: proyecto.codigo,
    nombre: proyecto.nombre,
    horasPresupuesto: proyecto.horasPresupuesto,
    fechaInicio: proyecto.fechaInicio,
    fechaFin: proyecto.fechaFin,
    activo: proyecto.activo,
    minutos: minutosConsumidos,
    riesgo,
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/control/proyectos" className="text-xs font-medium text-marca-700 hover:underline">
            Volver a proyectos
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {proyecto.codigo} · {proyecto.nombre}
            {proyecto.esAjuste ? (
              <span className="ml-2 align-middle etiqueta bg-slate-200 text-slate-600">Ajuste</span>
            ) : null}
          </h1>
          <p className="text-sm text-slate-600">
            {proyecto.horasPresupuesto ? `Presupuesto: ${proyecto.horasPresupuesto} h` : 'Sin presupuesto'}
            {' · '}
            {proyecto.fechaInicio || proyecto.fechaFin
              ? `Plazo: ${proyecto.fechaInicio ?? '?'} a ${proyecto.fechaFin ?? '?'}`
              : 'Sin plazo'}
          </p>
        </div>
      </div>

      {proyecto.esAjuste ? (
        <div className="rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <strong>Proyecto interno de ajuste.</strong> Recoge horas que no corresponden a un proyecto
          real. No tiene semáforo de presupuesto ni genera alertas de riesgo, pero sus horas y su
          coste sí suman en los totales de la empresa.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Dato titulo="Consumido" valor={`${formatearHorasReloj(minutosConsumidos)} (${riesgo.consumoPct ?? 0}%)`} />
            <Dato
              titulo="Restante"
              valor={riesgo.minutosRestantes === null ? '—' : formatearHorasReloj(Math.max(riesgo.minutosRestantes, 0))}
            />
            <Dato
              titulo="Plazo transcurrido"
              valor={
                riesgo.plazoPct === null
                  ? 'Sin fechas'
                  : `${riesgo.plazoPct}% (${riesgo.diasTranscurridos} de ${riesgo.diasTotales} días)`
              }
            />
            <Dato
              titulo="Proyección al cierre"
              valor={riesgo.proyeccionPct === null ? '—' : `${riesgo.proyeccionPct}% de consumo`}
            />
          </div>

          <div className="tarjeta p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Riesgo</h2>
              <span className={`etiqueta ${CLASES_RIESGO[riesgo.nivel]}`}>
                {riesgo.etiqueta}
              </span>
            </div>
            <p className="text-sm text-slate-700">{riesgo.detalle}</p>
            <p className="mt-1 text-xs text-slate-500">
              Desviación: {riesgo.desviacionPp === null ? '—' : `${riesgo.desviacionPp > 0 ? '+' : ''}${riesgo.desviacionPp} pp`}
              {ritmo !== null
                ? ` · Ritmo admisible desde hoy: ${formatearHorasReloj(ritmo)} al día para terminar en plazo.`
                : ''}
            </p>
          </div>

          <TablaRiesgo filas={[fila]} />
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="tarjeta p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Tareas</h2>
          <ul className="space-y-3">
            {tareas.map((tarea) => {
              const presupuesto = tarea.horasPresupuesto ? tarea.horasPresupuesto * 60 : null
              const consumo = presupuesto ? Math.round((tarea.minutos / presupuesto) * 100) : null
              const porcentaje = Math.round((tarea.minutos / maximoTarea) * 100)

              return (
                <li key={tarea.tareaId}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-slate-700">
                      <span className="font-medium text-slate-900">{tarea.codigo}</span> · {tarea.nombre}
                    </span>
                    <span className="shrink-0 font-mono text-slate-600">
                      {formatearHorasReloj(tarea.minutos)}
                      {presupuesto ? ` / ${tarea.horasPresupuesto} h` : ''}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${consumo !== null && consumo >= 100 ? 'bg-red-500' : 'bg-marca-600'}`}
                      style={{ width: `${Math.min(porcentaje, 100)}%` }}
                    />
                  </div>
                  {consumo !== null ? <p className="mt-0.5 text-[11px] text-slate-400">{consumo}% consumido</p> : null}
                </li>
              )
            })}
            {tareas.length === 0 ? <li className="text-sm text-slate-500">Sin tareas definidas.</li> : null}
          </ul>
        </div>

        <div className="tarjeta p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Últimas 12 semanas</h2>
          <GraficoEvolucion datos={tendencia} maximo={maximoSemana} etiqueta="Horas por semana del proyecto" />
        </div>
      </div>
    </section>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{titulo}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{valor}</p>
    </div>
  )
}
