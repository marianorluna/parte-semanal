import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRol } from '@/modules/identidad/application/sesion'
import { proyectosDeParte, proyectosPermitidos, rolDeEmpleado } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { formatearFecha, nombreDia, formatearRango } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { puedeRevisarParte } from '@/modules/partes/domain/permisos'
import { historialParte, obtenerParteDetalle } from '@/modules/partes/infrastructure/consultas-detalle'
import { depsComputo, depsCoste } from '@/composition'
import { agruparPorTipo, resumenDeParte } from '@/modules/computo/application/servicio'
import { ETIQUETAS_TIPO_HORA } from '@/modules/computo/domain/reglas'
import { costeDeParte } from '@/modules/coste/application/servicio'
import { formatearEuros } from '@/modules/coste/domain/coste'
import { EstadoBadge } from '@/components/EstadoBadge'
import { AccionesRevision } from './AccionesRevision'
import { BotonRecalcular } from './BotonRecalcular'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function ParteDetallePage({ params }: Props) {
  const usuario = await requireRol('ENCARGADO', 'ADMIN')
  const { id } = await params

  const parte = await obtenerParteDetalle(id)
  if (!parte) notFound()

  if (usuario.rol !== 'ADMIN') {
    // El encargado no revisa sus propias horas ni las de otro encargado o admin.
    const rolEmpleado = await rolDeEmpleado(parte.empleadoId)
    if (!puedeRevisarParte(usuario.rol, rolEmpleado)) notFound()

    const permitidos = await proyectosPermitidos(usuario)
    const delParte = await proyectosDeParte(parte.id)
    const autorizado = permitidos === null || delParte.some((p) => permitidos.includes(p))
    if (!autorizado) notFound()
  }

  const eventos = await historialParte(parte.id)
  const computo = await resumenDeParte(depsComputo, parte.id)
  const coste = await costeDeParte(depsCoste, parte.id)
  const computadoPorImputacion = new Map<string, number>()
  for (const tramo of computo.tramos) {
    computadoPorImputacion.set(
      tramo.imputacionId,
      (computadoPorImputacion.get(tramo.imputacionId) ?? 0) + tramo.minutosComputados,
    )
  }
  const porTipo = agruparPorTipo(computo.tramos)

  const porFecha = new Map<string, typeof parte.imputaciones>()
  for (const linea of parte.imputaciones) {
    const lista = porFecha.get(linea.fecha) ?? []
    lista.push(linea)
    porFecha.set(linea.fecha, lista)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/control/partes" className="text-xs font-medium text-marca-700 hover:underline">
            Volver a la bandeja
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{parte.empleadoNombre}</h1>
          <p className="text-sm text-slate-600">
            {parte.empleadoCodigo} · semana {parte.isoWeek} de {parte.isoYear} ·{' '}
            {formatearRango(parte.weekStart, addDays(parte.weekStart, 6))}
          </p>
        </div>

        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          <EstadoBadge estado={parte.estado} />
          <p className="text-2xl font-bold text-slate-900">{formatearHorasReloj(parte.totalMinutos)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/partes/${parte.id}/imprimir`} className="text-xs font-medium text-marca-700 hover:underline">
              Ver versión imprimible
            </Link>
            <a href={`/partes/${parte.id}/pdf`} className="text-xs font-medium text-marca-700 hover:underline">
              Descargar PDF
            </a>
            {usuario.rol === 'ADMIN' &&
            (parte.estado === 'APROBADO' || parte.estado === 'BLOQUEADO') ? (
              <BotonRecalcular parteId={parte.id} />
            ) : null}
          </div>
        </div>
      </div>

      {parte.motivoRechazo ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Motivo del rechazo:</strong> {parte.motivoRechazo}
        </p>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-slate-800">Jornada teórica y desviación</p>
          {parte.capacidadMin !== null ? (
            <p className="cifra text-slate-600">
              Teóricas {formatearHorasReloj(parte.capacidadMin)}
              {parte.desviacionMin !== null
                ? ` · Desviación ${parte.desviacionMin > 0 ? '+' : parte.desviacionMin < 0 ? '-' : ''}${formatearHorasReloj(Math.abs(parte.desviacionMin))}`
                : ''}
            </p>
          ) : (
            <p className="text-slate-500">Sin jornada teórica registrada en este parte</p>
          )}
        </div>
        {parte.motivoDesviacion ? (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            <strong>Motivo declarado:</strong> {parte.motivoDesviacion}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Sin desviación declarada.</p>
        )}
      </div>

      <div className="tarjeta hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Proyecto</th>
              <th className="px-3 py-2">Tarea</th>
              <th className="px-3 py-2 text-right">Horas</th>
            </tr>
          </thead>
          <tbody>
            {[...porFecha.entries()].map(([fecha, lineas]) => (
              <FragmentoFecha
                key={fecha}
                fecha={fecha}
                lineas={lineas}
                computadoPorImputacion={computadoPorImputacion}
              />
            ))}
            <tr className="border-t-2 border-slate-300 bg-marca-50 font-semibold">
              <td className="px-3 py-2" colSpan={3}>
                Total semana
              </td>
              <td className="px-3 py-2 text-right">{formatearHorasReloj(parte.totalMinutos)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {[...porFecha.entries()].map(([fecha, lineas]) => {
          const total = lineas.reduce((suma, linea) => suma + linea.minutos, 0)
          return (
            <div key={fecha} className="tarjeta p-3">
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-800 capitalize">
                  {nombreDia(fecha)} <span className="text-xs font-normal text-slate-500">{formatearFecha(fecha)}</span>
                </span>
                <span className="shrink-0 font-mono text-sm text-slate-700">{formatearHorasReloj(total)}</span>
              </div>
              <ul className="mt-2 space-y-2">
                {lineas.map((linea) => (
                  <li key={linea.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-sm text-slate-800">{linea.tareaNombre}</span>
                      <span className="shrink-0 font-mono text-sm text-slate-800">
                        {formatearHorasReloj(linea.minutos)}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-slate-500">
                      {linea.proyectoCodigo} · {linea.proyectoNombre}
                    </p>
                    {computadoPorImputacion.get(linea.id) !== undefined &&
                    computadoPorImputacion.get(linea.id) !== linea.minutos ? (
                      <p className="text-[11px] font-medium text-marca-700">
                        {formatearHorasReloj(computadoPorImputacion.get(linea.id) ?? 0)} computadas
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        <div className="tarjeta flex items-baseline justify-between p-3 font-semibold">
          <span>Total semana</span>
          <span className="font-mono">{formatearHorasReloj(parte.totalMinutos)}</span>
        </div>
      </div>

      {computo.tramos.length > 0 ? (
        <div className="tarjeta p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Cómputo aplicado</h2>
            <span className="text-xs text-slate-500">
              {computo.convenioNombre ?? 'Sin convenio (factor 1)'}
              {computo.convenioVersion ? ` · versión ${computo.convenioVersion}` : ''}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Minutos base</dt>
              <dd className="font-mono text-slate-800">{computo.resumen.minutosBase}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Computados</dt>
              <dd className="font-mono font-semibold text-slate-900">{computo.resumen.minutosComputados}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Diferencia</dt>
              <dd className="font-mono text-slate-800">
                {computo.resumen.minutosComputados - computo.resumen.minutosBase > 0 ? '+' : ''}
                {computo.resumen.minutosComputados - computo.resumen.minutosBase} min
              </dd>
            </div>
          </dl>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {porTipo.map((tipo) => (
              <li key={tipo.tipoHora} className="etiqueta bg-marca-50 text-marca-800">
                {ETIQUETAS_TIPO_HORA[tipo.tipoHora]} · {tipo.minutosBase} min → {tipo.minutosComputados}
              </li>
            ))}
          </ul>
          {computo.resumen.requiereAutorizacion ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Alguna regla exige autorización previa. Revisa la autorización antes de cerrar la nómina.
            </p>
          ) : null}
        </div>
      ) : parte.estado === 'APROBADO' ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este parte está aprobado pero no tiene snapshot de cómputo (anterior al motor de reglas).
          Recalcula desde administración para fijarlo.
        </p>
      ) : null}

      {coste.lineas.length > 0 ? (
        <div className="tarjeta p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Coste aplicado</h2>
            <span className="font-mono text-lg font-semibold text-slate-900">
              {formatearEuros(coste.totalCents)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Congelado al aprobar con la tarifa vigente a cada fecha · {formatearHorasReloj(coste.minutos)} costeadas
          </p>
          {coste.sinTarifa > 0 ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {coste.sinTarifa} de {coste.lineas.length} líneas no tenían tarifa vigente y computan a 0.
              Configura la tarifa en administración y recalcula el coste.
            </p>
          ) : null}
        </div>
      ) : parte.estado === 'APROBADO' ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este parte está aprobado pero no tiene snapshot de coste. Recalcula desde administración
          para fijarlo.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="tarjeta p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Revisión</h2>
          <AccionesRevision parteId={parte.id} version={parte.version} estado={parte.estado} />
          <dl className="mt-4 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between gap-2">
              <dt>Enviado</dt>
              <dd>{parte.enviadoAt ? formatearInstante(parte.enviadoAt) : 'Sin enviar'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Revisado por</dt>
              <dd>{parte.revisorNombre ?? 'Pendiente'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Última revisión</dt>
              <dd>{parte.revisadoAt ? formatearInstante(parte.revisadoAt) : 'Pendiente'}</dd>
            </div>
          </dl>
        </div>

        <div className="tarjeta p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial</h2>
          {eventos.length === 0 ? (
            <p className="text-xs text-slate-500">Sin eventos registrados.</p>
          ) : (
            <ol className="space-y-2 text-xs">
              {eventos.map((evento) => (
                <li key={evento.id} className="border-l-2 border-slate-200 pl-3">
                  <p className="font-medium text-slate-800">{etiquetaAccion(evento.accion)}</p>
                  <p className="text-slate-500">
                    {formatearInstante(evento.createdAt)} · {evento.actorNombre ?? 'Sistema'}
                  </p>
                  {evento.motivo ? <p className="mt-0.5 text-slate-600">{evento.motivo}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}

function FragmentoFecha({
  fecha,
  lineas,
  computadoPorImputacion,
}: {
  fecha: string
  lineas: { id: string; minutos: number; proyectoCodigo: string; proyectoNombre: string; tareaCodigo: string; tareaNombre: string; nota: string | null }[]
  computadoPorImputacion: Map<string, number>
}) {
  const total = lineas.reduce((suma, linea) => suma + linea.minutos, 0)

  return (
    <>
      {lineas.map((linea, indice) => {
        const computado = computadoPorImputacion.get(linea.id)
        const muestraComputado = computado !== undefined && computado !== linea.minutos

        return (
          <tr key={linea.id} className="border-b border-slate-100 last:border-0">
            <td className="px-3 py-2 align-top whitespace-nowrap">
              {indice === 0 ? (
                <>
                  <span className="block font-medium text-slate-800 capitalize">{nombreDia(fecha)}</span>
                  <span className="block text-xs text-slate-500">{formatearFecha(fecha)}</span>
                  <span className="block text-xs text-slate-500">{formatearHorasReloj(total)}</span>
                </>
              ) : null}
            </td>
            <td className="px-3 py-2">
              <span className="block text-xs text-slate-500">{linea.proyectoCodigo}</span>
              <span className="text-slate-800">{linea.proyectoNombre}</span>
            </td>
            <td className="px-3 py-2 text-slate-800">{linea.tareaNombre}</td>
            <td className="px-3 py-2 text-right font-mono">
              {formatearHorasReloj(linea.minutos)}
              {muestraComputado ? (
                <span className="block text-xs font-normal text-marca-700">
                  → {formatearHorasReloj(computado)} computadas
                </span>
              ) : null}
            </td>
          </tr>
        )
      })}
    </>
  )
}

function addDays(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T00:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() + dias)
  return base.toISOString().slice(0, 10)
}

function formatearInstante(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor)
}

function etiquetaAccion(accion: string): string {
  const etiquetas: Record<string, string> = {
    ENVIAR_PARTE: 'Parte enviado',
    APROBAR_PARTE: 'Parte aprobado',
    RECHAZAR_PARTE: 'Parte rechazado',
    REABRIR_PARTE: 'Parte reabierto',
  }
  return etiquetas[accion] ?? accion
}
