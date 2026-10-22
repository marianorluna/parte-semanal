'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { EstadoParte } from '@/db/schema'
import type { GrupoProyecto } from '@/modules/partes/application/agrupacion'
import { formatearHorasReloj, horasAMinutos, sumarMinutos } from '@/modules/partes/domain/horas'
import { etiquetaEstado } from '@/modules/partes/domain/parte'
import { EstadoBadge } from '@/components/EstadoBadge'
import { guardarSemanaAction, enviarSemanaAction } from './actions'

export type DiaSemana = {
  fecha: string
  dia: string
  esHoy: boolean
}

type Props = {
  isoYear: number
  isoWeek: number
  weekStart: string
  dias: DiaSemana[]
  grupos: GrupoProyecto[]
  inicial: Record<string, string>
  versionInicial: number
  estado: EstadoParte
  motivoRechazo: string | null
  editable: boolean
  navegacion: { anterior: string; siguiente: string; actual: string }
  nombreEmpleado: string
}

function clave(fecha: string, tareaId: string): string {
  return `${fecha}|${tareaId}`
}

export function RejillaSemanal({
  isoYear,
  isoWeek,
  dias,
  grupos,
  inicial,
  versionInicial,
  estado,
  motivoRechazo,
  editable,
  navegacion,
  nombreEmpleado,
}: Props) {
  const router = useRouter()
  const [valores, setValores] = useState<Record<string, string>>(inicial)
  const [version, setVersion] = useState(versionInicial)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [hayCambios, setHayCambios] = useState(false)
  const [pendienteEnvio, iniciarEnvio] = useTransition()
  const ediciones = useRef(0)

  const celdas = useMemo(() => {
    return Object.entries(valores).map(([llave, texto]) => {
      const [fecha, tareaId] = llave.split('|')
      const parseado = horasAMinutos(texto)
      return {
        fecha: fecha ?? '',
        tareaId: tareaId ?? '',
        texto,
        minutos: parseado.ok ? parseado.minutos : 0,
        error: parseado.ok ? null : parseado.error,
      }
    })
  }, [valores])

  const totalDia = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const celda of celdas) {
      mapa[celda.fecha] = (mapa[celda.fecha] ?? 0) + celda.minutos
    }
    return mapa
  }, [celdas])

  const totalTarea = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const celda of celdas) {
      mapa[celda.tareaId] = (mapa[celda.tareaId] ?? 0) + celda.minutos
    }
    return mapa
  }, [celdas])

  const total = sumarMinutos(celdas.map((c) => c.minutos))
  const avisos: string[] = []
  for (const dia of dias) {
    if ((totalDia[dia.fecha] ?? 0) > 12 * 60) avisos.push(`${dia.dia} supera 12 horas`)
  }
  if (total > 48 * 60) avisos.push('La semana supera 48 horas')
  const hayErrores = celdas.some((c) => c.error !== null)

  const guardar = useCallback(
    async (silencioso = false): Promise<number | null> => {
      if (hayErrores) {
        setError('Corrige las celdas marcadas antes de guardar')
        return null
      }

      setGuardando(true)
      setError('')
      if (!silencioso) setMensaje('')

      const filas = celdas
        .filter((c) => c.minutos > 0)
        .map((c) => ({ fecha: c.fecha, tareaId: c.tareaId, minutos: c.minutos }))

      const edicionAlGuardar = ediciones.current
      const respuesta = await guardarSemanaAction({ isoYear, isoWeek, version, filas })
      setGuardando(false)

      if (!respuesta.success) {
        setError(respuesta.error.message)
        return null
      }

      setVersion(respuesta.data.version)
      if (ediciones.current === edicionAlGuardar) setHayCambios(false)
      setMensaje('Guardado')
      return respuesta.data.version
    },
    [celdas, hayErrores, isoWeek, isoYear, version],
  )

  useEffect(() => {
    if (!editable || !hayCambios || hayErrores || guardando) return
    const temporizador = setTimeout(() => {
      void guardar(true)
    }, 900)
    return () => clearTimeout(temporizador)
  }, [valores, hayCambios, hayErrores, editable, guardando, guardar])

  function cambiar(fecha: string, tareaId: string, texto: string) {
    ediciones.current += 1
    setValores((anterior) => ({ ...anterior, [clave(fecha, tareaId)]: texto }))
    setHayCambios(true)
    setMensaje('')
  }

  function enviar() {
    iniciarEnvio(async () => {
      const versionGuardada = await guardar()
      if (versionGuardada === null) return

      const respuesta = await enviarSemanaAction({ isoYear, isoWeek, version: versionGuardada })
      if (!respuesta.success) {
        setError(respuesta.error.message)
        return
      }

      router.refresh()
    })
  }

  const deshabilitado = !editable

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mi semana</h1>
          <p className="text-sm text-slate-600">
            {nombreEmpleado} · semana {isoWeek} de {isoYear}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={navegacion.anterior} className="boton-secundario px-3 py-1.5 text-xs">
            Anterior
          </Link>
          <Link href={navegacion.actual} className="boton-secundario px-3 py-1.5 text-xs">
            Esta semana
          </Link>
          <Link href={navegacion.siguiente} className="boton-secundario px-3 py-1.5 text-xs">
            Siguiente
          </Link>
        </div>
      </div>

      {estado === 'RECHAZADO' && motivoRechazo ? (
        <div role="status" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Parte rechazado.</strong> {motivoRechazo}
        </div>
      ) : null}

      {estado === 'ENVIADO' ? (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Parte enviado y pendiente de revisión. No se puede editar hasta que se rechace.
        </div>
      ) : null}

      {estado === 'APROBADO' ? (
        <div role="status" className="rounded-md border border-acento-200 bg-acento-50 px-4 py-3 text-sm text-acento-900">
          Parte aprobado. Si necesitas un cambio, pide al encargado que lo reabra.
        </div>
      ) : null}

      {grupos.length === 0 ? (
        <div className="tarjeta p-8 text-center">
          <p className="text-sm text-slate-600">
            No tienes tareas asignadas para esta semana. Pide a administración que revise tus asignaciones.
          </p>
        </div>
      ) : (
        <>
          <div className="tarjeta hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-marca-50">
                  <th scope="col" className="sticky left-0 z-10 min-w-56 bg-marca-50 px-3 py-2 text-left font-semibold text-marca-900">
                    Proyecto / tarea
                  </th>
                  {dias.map((dia) => (
                    <th
                      key={dia.fecha}
                      scope="col"
                      className={`w-20 px-2 py-2 text-center font-semibold ${dia.esHoy ? 'bg-acento-50 text-marca-900' : 'text-slate-700'}`}
                    >
                      <span className="block text-xs uppercase">{dia.dia}</span>
                      <span className="block text-[11px] font-normal text-slate-500">
                        {dia.fecha.slice(8, 10)}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="w-24 px-2 py-2 text-right font-semibold text-slate-700">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((grupo) => (
                  <GrupoFilas
                    key={grupo.proyectoId}
                    grupo={grupo}
                    dias={dias}
                    valores={valores}
                    totalTarea={totalTarea}
                    totalDia={totalDia}
                    deshabilitado={deshabilitado}
                    cambiar={cambiar}
                  />
                ))}
                <tr className="border-t-2 border-slate-300 bg-marca-50 font-semibold">
                  <th scope="row" className="sticky left-0 z-10 bg-marca-50 px-3 py-2 text-left">
                    Total día
                  </th>
                  {dias.map((dia) => (
                    <td key={dia.fecha} className={`px-2 py-2 text-center ${(totalDia[dia.fecha] ?? 0) > 12 * 60 ? 'text-amber-700' : ''}`}>
                      {totalDia[dia.fecha] ? formatearHorasReloj(totalDia[dia.fecha] ?? 0) : '—'}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right">{formatearHorasReloj(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            {dias.map((dia) => (
              <div key={dia.fecha} className="tarjeta p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className={`text-sm font-semibold capitalize ${dia.esHoy ? 'text-acento-800' : 'text-slate-800'}`}>
                    {dia.dia} {dia.fecha.slice(8, 10)}/{dia.fecha.slice(5, 7)}
                  </h2>
                  <span className="text-xs text-slate-500">{formatearHorasReloj(totalDia[dia.fecha] ?? 0)}</span>
                </div>

                <div className="space-y-2">
                  {grupos.flatMap((grupo) =>
                    grupo.tareas.map((tarea) => (
                      <label key={`${dia.fecha}-${tarea.tareaId}`} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 flex-1 text-xs text-slate-600">
                          <span className="block truncate font-medium text-slate-800">{grupo.proyectoCodigo}</span>
                          <span className="block truncate">{tarea.tareaNombre}</span>
                        </span>
                        <input
                          inputMode="decimal"
                          type="text"
                          aria-label={`${grupo.proyectoCodigo} ${tarea.tareaNombre} ${dia.dia}`}
                          value={valores[clave(dia.fecha, tarea.tareaId)] ?? ''}
                          onChange={(evento) => cambiar(dia.fecha, tarea.tareaId, evento.target.value)}
                          disabled={deshabilitado}
                          className={`campo w-20 text-center ${
                            valores[clave(dia.fecha, tarea.tareaId)]
                              ? horasAMinutos(valores[clave(dia.fecha, tarea.tareaId)] ?? '').ok
                                ? ''
                                : 'border-red-400 bg-red-50'
                              : ''
                          }`}
                          placeholder="0"
                        />
                      </label>
                    )),
                  )}
                </div>
              </div>
            ))}

            <div className="tarjeta flex items-center justify-between p-4 text-sm font-semibold">
              <span>Total semana</span>
              <span>{formatearHorasReloj(total)}</span>
            </div>
          </div>
        </>
      )}

      {avisos.length > 0 ? (
        <ul className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <EstadoBadge estado={estado} />
            <span>{guardando ? 'Guardando...' : mensaje}</span>
            {hayCambios && !guardando ? <span className="text-xs text-amber-700">cambios sin guardar</span> : null}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => void guardar()} disabled={guardando || hayErrores} className="boton-secundario">
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={pendienteEnvio || guardando || hayErrores || total === 0}
              className="boton-primario"
            >
              {pendienteEnvio ? 'Enviando...' : 'Enviar parte'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <EstadoBadge estado={estado} />
          <span className="text-sm text-slate-600">Total de la semana: {formatearHorasReloj(total)}</span>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Puedes escribir 7,5 · 7.5 · 7:30. El parte pasa a {etiquetaEstado('ENVIADO').toLowerCase()} cuando lo envías y
        queda bloqueado hasta la revisión.
      </p>
    </section>
  )
}

function GrupoFilas({
  grupo,
  dias,
  valores,
  totalTarea,
  totalDia,
  deshabilitado,
  cambiar,
}: {
  grupo: GrupoProyecto
  dias: DiaSemana[]
  valores: Record<string, string>
  totalTarea: Record<string, number>
  totalDia: Record<string, number>
  deshabilitado: boolean
  cambiar: (fecha: string, tareaId: string, texto: string) => void
}) {
  return (
    <>
      <tr className="bg-white">
        <th scope="rowgroup" colSpan={dias.length + 2} className="px-3 pt-3 pb-1 text-left text-xs font-semibold tracking-wide text-marca-800 uppercase">
          {grupo.proyectoCodigo} · {grupo.proyectoNombre}
        </th>
      </tr>
      {grupo.tareas.map((tarea) => (
        <tr key={tarea.tareaId} className="border-b border-slate-100 last:border-0">
          <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-normal">
            <span className="block text-sm text-slate-800">{tarea.tareaNombre}</span>
            <span className="block text-[11px] text-slate-500">{tarea.tareaCodigo}</span>
          </th>
          {dias.map((dia) => {
            const llave = clave(dia.fecha, tarea.tareaId)
            const texto = valores[llave] ?? ''
            const parseado = horasAMinutos(texto)
            return (
              <td key={dia.fecha} className={`px-1 py-1 ${dia.esHoy ? 'bg-acento-50/60' : ''}`}>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`${grupo.proyectoCodigo} ${tarea.tareaNombre} ${dia.dia}`}
                  value={texto}
                  onChange={(evento) => cambiar(dia.fecha, tarea.tareaId, evento.target.value)}
                  disabled={deshabilitado}
                  title={parseado.ok ? undefined : parseado.error}
                  className={`w-full rounded border px-1 py-1 text-center text-sm ${
                    texto !== '' && !parseado.ok
                      ? 'border-red-400 bg-red-50 text-red-800'
                      : 'border-transparent bg-transparent hover:border-slate-200 focus:border-marca-500 focus:bg-white'
                  }`}
                  placeholder=""
                />
              </td>
            )
          })}
          <td className="px-2 py-1 text-right text-sm font-medium text-slate-700">
            {totalTarea[tarea.tareaId] ? formatearHorasReloj(totalTarea[tarea.tareaId] ?? 0) : '—'}
          </td>
        </tr>
      ))}
      <tr aria-hidden="true">
        <td colSpan={dias.length + 2} className="h-1 px-3">
          <span className="block text-[11px] text-slate-400">
            {dias
              .filter((dia) => (totalDia[dia.fecha] ?? 0) > 0)
              .map((dia) => `${dia.dia} ${formatearHorasReloj(totalDia[dia.fecha] ?? 0)}`)
              .join(' · ')}
          </span>
        </td>
      </tr>
    </>
  )
}
