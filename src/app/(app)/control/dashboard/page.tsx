import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { hoyEnZona, semanaIso, semanaIsoDe, sumarDias } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import {
  evolucionSemanal,
  horasPorProyecto,
  resumenSemana,
  topEmpleados,
} from '@/modules/reporting/infrastructure/consultas'

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

  const [resumen, porProyecto, top, evolucion] = await Promise.all([
    resumenSemana(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos),
    horasPorProyecto(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos),
    topEmpleados(usuario.empresaId, semana.isoYear, semana.isoWeek, permitidos, 5),
    evolucionSemanal(
      usuario.empresaId,
      sumarDias(semana.weekStart, -7 * 7),
      semana.weekEnd,
      permitidos,
    ),
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

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Semana {semana.isoWeek} de {semana.isoYear}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/control/dashboard?y=${semana.isoYear}&w=${semana.isoWeek - 1}`} className="boton-secundario px-3 py-1.5 text-xs">
            Semana anterior
          </Link>
          <Link href={`/control/dashboard?y=${semanaHoy.isoYear}&w=${semanaHoy.isoWeek}`} className="boton-secundario px-3 py-1.5 text-xs">
            Esta semana
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Horas imputadas" valor={formatearHorasReloj(resumen.totalMinutos)} detalle="en la semana" />
        <Kpi titulo="Partes" valor={String(resumen.partes)} detalle={`${resumen.empleados} empleados`} />
        <Kpi
          titulo="Pendientes"
          valor={String(resumen.pendientes)}
          detalle="sin revisar"
          destacado={resumen.pendientes > 0}
          href="/control/partes?estado=ENVIADO"
        />
        <Kpi
          titulo="Antigüedad máxima"
          valor={resumen.pendientes > 0 ? `${diasEspera} d` : '0 d'}
          detalle="del parte más antiguo"
          destacado={diasEspera > 5}
        />
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
                      <p className="mt-0.5 text-[11px] text-slate-400">{consumo}% del presupuesto semanal teórico</p>
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

function Kpi({
  titulo,
  valor,
  detalle,
  destacado,
  href,
}: {
  titulo: string
  valor: string
  detalle: string
  destacado?: boolean
  href?: string
}) {
  const contenido = (
    <div className={`tarjeta p-4 ${destacado ? 'border-amber-300' : ''}`}>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
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

function GraficoEvolucion({
  datos,
  maximo,
}: {
  datos: { isoYear: number; isoWeek: number; minutos: number }[]
  maximo: number
}) {
  if (datos.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Sin histórico.</p>
  }

  const ancho = 320
  const alto = 120
  const margen = 8
  const paso = datos.length > 1 ? (ancho - margen * 2) / (datos.length - 1) : 0

  const puntos = datos.map((fila, indice) => {
    const x = margen + indice * paso
    const y = alto - margen - (fila.minutos / maximo) * (alto - margen * 2)
    return { x, y, ...fila }
  })

  const trazo = puntos.map((punto) => `${punto.x.toFixed(1)},${punto.y.toFixed(1)}`).join(' ')
  const area = `${margen},${alto - margen} ${trazo} ${(margen + (datos.length - 1) * paso).toFixed(1)},${alto - margen}`

  return (
    <figure>
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Horas por semana en las últimas 8 semanas" className="w-full">
        <polygon points={area} fill="rgb(0 84 83 / 0.12)" />
        <polyline points={trazo} fill="none" stroke="rgb(3 106 105)" strokeWidth="2" strokeLinejoin="round" />
        {puntos.map((punto) => (
          <circle key={`${punto.isoYear}-${punto.isoWeek}`} cx={punto.x} cy={punto.y} r="2.5" fill="rgb(0 152 120)" />
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>W{datos[0]?.isoWeek}</span>
        <span>W{datos[datos.length - 1]?.isoWeek}</span>
      </figcaption>
    </figure>
  )
}
