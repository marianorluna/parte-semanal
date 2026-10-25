import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { formatearRango, hoyEnZona, semanaIso, semanaIsoDe, sumarDias } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { requiereAccionDelTrabajador } from '@/modules/reporting/domain/cumplimiento'
import {
  severidadAntiguedad,
  severidadCumplimiento,
  severidadPendientesRevision,
  severidadProyectosEnRiesgo,
  severidadSinEnviar,
} from '@/modules/reporting/domain/severidad'
import {
  detalleCumplimientoDeSemana,
  panelRiesgo,
} from '@/modules/reporting/application/panel'
import {
  evolucionSemanal,
  horasPorProyecto,
  resumenSemana,
  topEmpleados,
} from '@/modules/reporting/infrastructure/consultas'
import { TablaRiesgo } from '@/components/TablaRiesgo'
import { GraficoEvolucion } from '@/components/GraficoEvolucion'
import { TarjetaColapsable } from '@/components/TarjetaColapsable'
import { depsAsistente } from '@/composition'
import { BriefingSemanal } from './BriefingSemanal'
import { ResumenDashboard } from './ResumenDashboard'
import { RecordarPendientes } from './AccionesResumen'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ y?: string; w?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const usuario = await requireRol('ENCARGADO', 'ADMIN')
  const params = await searchParams

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaHoy = semanaIsoDe(hoy)

  const semana = (() => {
    try {
      return semanaIso(Number(params.y ?? semanaHoy.isoYear), Number(params.w ?? semanaHoy.isoWeek))
    } catch {
      return semanaHoy
    }
  })()

  const permitidos = await proyectosPermitidos(usuario)

  const [resumen, porProyecto, top, evolucion, panel, cumplimiento] = await Promise.all([
    resumenSemana(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos),
    horasPorProyecto(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos),
    topEmpleados(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos, 5),
    evolucionSemanal(usuario.empresaId, sumarDias(semana.weekStart, -7 * 7), semana.weekEnd, permitidos),
    panelRiesgo(usuario.empresaId, permitidos, hoy),
    detalleCumplimientoDeSemana(usuario, semana, hoy),
  ])

  const maximoProyecto = Math.max(...porProyecto.map((fila) => fila.minutos), 1)
  const maximoSemana = Math.max(...evolucion.map((fila) => fila.minutos), 1)
  const totalProyectos = porProyecto.reduce((suma, fila) => suma + fila.minutos, 0)

  const diasEspera = resumen.pendienteMasAntiguo
    ? Math.max(
        0,
        Math.floor(
          (new Date(`${hoy}T00:00:00.000Z`).getTime() -
            new Date(resumen.pendienteMasAntiguo).getTime()) /
            86_400_000,
        ),
      )
    : 0

  const proyectosEnRiesgo = panel.resumen.agotados + panel.resumen.criticos + panel.resumen.avisos
  const severidadCumplimientoSemana = severidadCumplimiento(cumplimiento.resumen.cumplimientoPct)
  const querySemana = `y=${semana.isoYear}&w=${semana.isoWeek}`

  const anterior = semanaIsoDe(sumarDias(semana.weekStart, -7))
  const siguiente = semanaIsoDe(sumarDias(semana.weekStart, 7))

  const recordables = cumplimiento.personas
    .filter((persona) => requiereAccionDelTrabajador(persona.estado))
    .map((persona) => persona.usuarioId)

  return (
    <section className="space-y-5">
      <ResumenDashboard
        isoYear={semana.isoYear}
        isoWeek={semana.isoWeek}
        rango={formatearRango(semana.weekStart, semana.weekEnd)}
        navegacion={{
          anterior: `/control/dashboard?y=${anterior.isoYear}&w=${anterior.isoWeek}`,
          siguiente: `/control/dashboard?y=${siguiente.isoYear}&w=${siguiente.isoWeek}`,
          actual: `/control/dashboard?y=${semanaHoy.isoYear}&w=${semanaHoy.isoWeek}`,
        }}
        consultaExport={querySemana}
        metricas={{
          cumplimientoPct: cumplimiento.resumen.cumplimientoPct,
          pendientes: resumen.pendientes,
          sinEnviar: cumplimiento.resumen.pendientesDelTrabajador,
          proyectosEnRiesgo,
          totalMinutos: resumen.totalMinutos,
          partes: resumen.partes,
          empleados: resumen.empleados,
          diasEspera,
          proyectosActivos: panel.filas.filter((fila) => fila.activo).length,
          proyectosEnRitmo: panel.resumen.ok,
          sinPresupuesto: panel.resumen.sinDatos,
        }}
        severidades={{
          cumplimiento: severidadCumplimientoSemana,
          pendientes: severidadPendientesRevision(resumen.pendientes),
          sinEnviar: severidadSinEnviar(cumplimiento.resumen.pendientesDelTrabajador),
          riesgo: severidadProyectosEnRiesgo(panel.resumen),
        }}
        personas={cumplimiento.personas}
        cumplimiento={cumplimiento.resumen}
        recordar={
          recordables.length > 0 ? (
            <RecordarPendientes
              usuarioIds={recordables}
              isoYear={semana.isoYear}
              isoWeek={semana.isoWeek}
            />
          ) : null
        }
        briefing={
          <BriefingSemanal
            isoYear={semana.isoYear}
            isoWeek={semana.isoWeek}
            disponible={depsAsistente.proveedor.disponible()}
          />
        }
      />

      <TarjetaColapsable
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Presupuesto y plazo por proyecto
            {proyectosEnRiesgo > 0 ? (
              <span className="etiqueta bg-red-100 text-red-800">{proyectosEnRiesgo} en riesgo</span>
            ) : (
              <span className="etiqueta bg-acento-100 text-acento-800">Todo en ritmo</span>
            )}
          </span>
        }
        resumen={`${panel.filas.filter((fila) => fila.activo).length} proyectos activos · ${
          proyectosEnRiesgo > 0 ? `${proyectosEnRiesgo} en riesgo` : 'sin desviaciones'
        }`}
        accion={
          <Link href="/control/proyectos" className="text-xs font-medium text-marca-700 hover:underline">
            Ver detalle
          </Link>
        }
      >
        <TablaRiesgo filas={panel.filas} />
      </TarjetaColapsable>

      <div className="grid gap-4 lg:grid-cols-5">
        <TarjetaColapsable
          className="min-w-0 lg:col-span-3"
          titulo="Horas por proyecto"
          resumen={`${formatearHorasReloj(totalProyectos)} imputadas en ${porProyecto.length} ${
            porProyecto.length === 1 ? 'proyecto' : 'proyectos'
          }`}
        >
          {porProyecto.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin imputaciones esta semana.</p>
          ) : (
            <ul className="space-y-2.5">
              {porProyecto.map((fila) => {
                const porcentaje = Math.round((fila.minutos / maximoProyecto) * 100)
                const presupuestoMinutos = fila.horasPresupuesto ? fila.horasPresupuesto * 60 : null
                // El comodín no se compara con presupuesto: el porcentaje no significaría nada.
                const consumo =
                  presupuestoMinutos && !fila.esAjuste
                    ? Math.round((fila.minutos / presupuestoMinutos) * 100)
                    : null

                return (
                  <li key={fila.proyectoId}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate text-slate-700">
                        <span className="font-medium text-slate-900">{fila.codigo}</span> · {fila.nombre}
                        {fila.esAjuste ? (
                          <span className="ml-1.5 rounded bg-slate-200 px-1 text-[10px] font-semibold text-slate-600">
                            Ajuste
                          </span>
                        ) : null}
                      </span>
                      <span className="cifra shrink-0 text-slate-600">{formatearHorasReloj(fila.minutos)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-marca-600" style={{ width: `${porcentaje}%` }} />
                    </div>
                    {consumo !== null ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {consumo}% del presupuesto consumido en la semana
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </TarjetaColapsable>

        <div className="tarjeta min-w-0 p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Tendencia 8 semanas</h2>
          <GraficoEvolucion datos={evolucion} maximo={maximoSemana} />
          <ul className="mt-3 space-y-1 text-xs">
            <li className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Top 5 empleados</li>
            {top.length === 0 ? (
              <li className="text-slate-500">Sin datos de empleados.</li>
            ) : (
              top.map((fila, indice) => (
                <li key={fila.empleadoId} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-slate-700">
                    {indice + 1}. {fila.nombre}
                  </span>
                  <span className="cifra shrink-0 text-slate-600">{formatearHorasReloj(fila.minutos)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Los datos se calculan sobre partes enviados, aprobados y rechazados. Los borradores no computan.
        Antigüedad máxima: {severidadAntiguedad(diasEspera) === 'NEUTRO' ? 'sin pendientes' : `${diasEspera} días`}.
      </p>
    </section>
  )
}
