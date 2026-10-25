import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { formatearRango, hoyEnZona, semanaIso, semanaIsoDe, sumarDias } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { CLASES_CUMPLIMIENTO, ETIQUETAS_CUMPLIMIENTO } from '@/modules/reporting/domain/cumplimiento'
import {
  ETIQUETAS_SEVERIDAD,
  severidadAntiguedad,
  severidadCumplimiento,
  severidadPendientesRevision,
  severidadProyectosEnRiesgo,
  severidadSinEnviar,
  type Severidad,
} from '@/modules/reporting/domain/severidad'
import { avisosDelPanel } from '@/modules/reporting/application/avisos'
import { panelRiesgo, resumenCumplimientoDeSemana } from '@/modules/reporting/application/panel'
import {
  evolucionSemanal,
  horasPorProyecto,
  resumenSemana,
  topEmpleados,
} from '@/modules/reporting/infrastructure/consultas'
import { TablaRiesgo } from '@/components/TablaRiesgo'
import { GraficoEvolucion } from '@/components/GraficoEvolucion'

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
    resumenCumplimientoDeSemana(usuario, semana),
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
  const avisos = avisosDelPanel({
    pendientesRevision: resumen.pendientes,
    personasSinEnviar: cumplimiento.pendientesDelTrabajador,
    riesgo: panel.resumen,
  })
  const severidadCumplimientoSemana = severidadCumplimiento(cumplimiento.cumplimientoPct)
  const querySemana = `y=${semana.isoYear}&w=${semana.isoWeek}`

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Semana {semana.isoWeek} de {semana.isoYear} · {formatearRango(semana.weekStart, semana.weekEnd)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/control/dashboard?y=${semana.isoYear}&w=${semana.isoWeek - 1}`}
            className="boton-secundario px-3 py-1.5 text-xs"
          >
            Semana anterior
          </Link>
          <Link
            href={`/control/dashboard?y=${semanaHoy.isoYear}&w=${semanaHoy.isoWeek}`}
            className="boton-secundario px-3 py-1.5 text-xs"
          >
            Esta semana
          </Link>
          <Link
            href={`/control/dashboard/exportar?formato=xlsx&${querySemana}`}
            className="boton-secundario px-3 py-1.5 text-xs"
          >
            Excel
          </Link>
          <Link
            href={`/control/dashboard/exportar?formato=pdf&${querySemana}`}
            className="boton-secundario px-3 py-1.5 text-xs"
          >
            PDF
          </Link>
        </div>
      </div>

      {avisos.avisos.length > 0 ? (
        <div
          role="status"
          className={`rounded-md border px-4 py-3 text-sm ${CLASES_SEVERIDAD[avisos.severidad].banner}`}
        >
          <p className="font-semibold">Necesita tu atención</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {avisos.avisos.map((aviso) => (
              <li key={aviso.href}>
                <Link href={aviso.href} className="underline">
                  {aviso.texto}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/notificaciones" className="underline">
                Ver avisos
              </Link>
            </li>
          </ul>
        </div>
      ) : (
        <div
          role="status"
          className={`rounded-md border px-4 py-3 text-sm ${CLASES_SEVERIDAD.OK.banner}`}
        >
          <p className="font-semibold">Sin incidencias</p>
          <p className="mt-0.5">Ningún parte pendiente de revisión ni proyecto en riesgo esta semana.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <Kpi
          titulo="Horas imputadas"
          valor={formatearHorasReloj(resumen.totalMinutos)}
          detalle="en la semana"
          severidad="NEUTRO"
        />
        <Kpi
          titulo="Partes"
          valor={String(resumen.partes)}
          detalle={`${resumen.empleados} empleados`}
          severidad="NEUTRO"
        />
        <Kpi
          titulo="Pendientes"
          valor={String(resumen.pendientes)}
          detalle="sin revisar"
          severidad={severidadPendientesRevision(resumen.pendientes)}
          href="/control/partes?estado=ENVIADO"
        />
        <Kpi
          titulo="Antigüedad máxima"
          valor={resumen.pendientes > 0 ? `${diasEspera} d` : '0 d'}
          detalle="del parte más antiguo"
          severidad={severidadAntiguedad(resumen.pendientes > 0 ? diasEspera : 0)}
        />
        <Kpi
          titulo="Sin enviar"
          valor={String(cumplimiento.pendientesDelTrabajador)}
          detalle="personas que deben cargar horas"
          severidad={severidadSinEnviar(cumplimiento.pendientesDelTrabajador)}
          href="/control/equipo"
        />
        <Kpi
          titulo="Cumplimiento"
          valor={`${cumplimiento.cumplimientoPct}%`}
          detalle="partes enviados o aprobados"
          severidad={severidadCumplimientoSemana}
          href="/control/equipo"
        />
        <Kpi
          titulo="Proyectos en riesgo"
          valor={String(proyectosEnRiesgo)}
          detalle={`${panel.resumen.agotados} agotados · ${panel.resumen.criticos} críticos · ${panel.resumen.avisos} avisos`}
          severidad={severidadProyectosEnRiesgo(panel.resumen)}
          href="/control/proyectos"
        />
        <Kpi
          titulo="Proyectos activos"
          valor={String(panel.filas.filter((fila) => fila.activo).length)}
          detalle={`${panel.resumen.ok} en ritmo · ${panel.resumen.sinDatos} sin presupuesto o plazo`}
          severidad="NEUTRO"
          href="/control/proyectos"
        />
      </div>

      <div className="tarjeta p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Presupuesto y plazo por proyecto</h2>
          <Link href="/control/proyectos" className="text-xs font-medium text-marca-700 hover:underline">
            Ver detalle
          </Link>
        </div>
        <TablaRiesgo filas={panel.filas} />
      </div>

      <div className="tarjeta p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Cumplimiento del equipo</h2>
          <Link href="/control/equipo" className="text-xs font-medium text-marca-700 hover:underline">
            Abrir equipo
          </Link>
        </div>

        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <span className={`text-lg font-bold ${CLASES_SEVERIDAD[severidadCumplimientoSemana].valor}`}>
            {cumplimiento.cumplimientoPct}%
          </span>
          <span className="text-xs text-slate-600">de partes enviados o aprobados</span>
          <span className={`etiqueta ${CLASES_SEVERIDAD[severidadCumplimientoSemana].etiqueta}`}>
            {ETIQUETAS_SEVERIDAD[severidadCumplimientoSemana]}
          </span>
        </div>

        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${CLASES_BARRA[severidadCumplimientoSemana]}`}
            style={{ width: `${cumplimiento.cumplimientoPct}%` }}
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {(['APROBADO', 'ENVIADO', 'BORRADOR', 'RECHAZADO', 'SIN_PARTE'] as const).map((estado) => {
            const valor =
              estado === 'APROBADO'
                ? cumplimiento.aprobados
                : estado === 'ENVIADO'
                  ? cumplimiento.enviados
                  : estado === 'BORRADOR'
                    ? cumplimiento.borradores
                    : estado === 'RECHAZADO'
                      ? cumplimiento.rechazados
                      : cumplimiento.sinParte
            return (
              <span key={estado} className={`etiqueta ${CLASES_CUMPLIMIENTO[estado]}`}>
                {ETIQUETAS_CUMPLIMIENTO[estado]}: {valor}
              </span>
            )
          })}
          <span className="ml-auto text-slate-500">{cumplimiento.total} personas en tu ámbito</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="tarjeta p-4 lg:col-span-3">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Horas por proyecto</h2>
            <span className="text-xs text-slate-500">{formatearHorasReloj(totalProyectos)}</span>
          </div>

          {porProyecto.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin imputaciones esta semana.</p>
          ) : (
            <ul className="space-y-2.5">
              {porProyecto.map((fila) => {
                const porcentaje = Math.round((fila.minutos / maximoProyecto) * 100)
                const presupuestoMinutos = fila.horasPresupuesto ? fila.horasPresupuesto * 60 : null
                const consumo = presupuestoMinutos ? Math.round((fila.minutos / presupuestoMinutos) * 100) : null

                return (
                  <li key={fila.proyectoId}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate text-slate-700">
                        <span className="font-medium text-slate-900">{fila.codigo}</span> · {fila.nombre}
                      </span>
                      <span className="shrink-0 font-mono text-slate-600">{formatearHorasReloj(fila.minutos)}</span>
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
        </div>

        <div className="tarjeta p-4 lg:col-span-2">
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
                  <span className="shrink-0 font-mono text-slate-600">{formatearHorasReloj(fila.minutos)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Los datos se calculan sobre partes enviados, aprobados y rechazados. Los borradores no computan.
      </p>
    </section>
  )
}

/**
 * Paleta del semáforo en clases Tailwind. Debe coincidir en criterio con
 * `paleta.ts` del exportador: mismo umbral, mismo mensaje.
 */
const CLASES_SEVERIDAD: Record<Severidad, { tarjeta: string; valor: string; etiqueta: string; banner: string }> = {
  ALERTA: {
    tarjeta: 'border-red-300 bg-red-50',
    valor: 'text-red-900',
    etiqueta: 'bg-red-100 text-red-800',
    banner: 'border-red-300 bg-red-50 text-red-900',
  },
  AVISO: {
    tarjeta: 'border-amber-300 bg-amber-50',
    valor: 'text-amber-900',
    etiqueta: 'bg-amber-100 text-amber-800',
    banner: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  OK: {
    tarjeta: 'border-acento-200',
    valor: 'text-slate-900',
    etiqueta: 'bg-acento-100 text-acento-800',
    banner: 'border-acento-200 bg-acento-50 text-acento-900',
  },
  NEUTRO: {
    tarjeta: '',
    valor: 'text-slate-900',
    etiqueta: 'bg-slate-100 text-slate-600',
    banner: 'border-slate-200 bg-slate-50 text-slate-700',
  },
}

const CLASES_BARRA: Record<Severidad, string> = {
  ALERTA: 'bg-red-500',
  AVISO: 'bg-amber-500',
  OK: 'bg-acento-500',
  NEUTRO: 'bg-slate-400',
}

function Kpi({
  titulo,
  valor,
  detalle,
  severidad,
  href,
}: {
  titulo: string
  valor: string
  detalle: string
  severidad: Severidad
  href?: string
}) {
  const colores = CLASES_SEVERIDAD[severidad]
  const conSemaforo = severidad !== 'NEUTRO'

  const contenido = (
    <div className={`tarjeta p-4 ${colores.tarjeta}`}>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{titulo}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className={`text-2xl font-bold ${colores.valor}`}>{valor}</p>
        {conSemaforo ? (
          <span className={`etiqueta ${colores.etiqueta}`}>{ETIQUETAS_SEVERIDAD[severidad]}</span>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">{detalle}</p>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-80">
        {contenido}
      </Link>
    )
  }

  return contenido
}
