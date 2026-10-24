'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { EstadoParte } from '@/db/schema'
import type { GrupoProyecto } from '@/modules/partes/application/agrupacion'
import {
  aTextoEditable,
  formatearHorasReloj,
  horasAMinutos,
  MINUTOS_POR_DIA,
  sumarMinutos,
} from '@/modules/partes/domain/horas'
import { etiquetaEstado } from '@/modules/partes/domain/parte'
import { EstadoBadge } from '@/components/EstadoBadge'
import { guardarSemanaAction, enviarSemanaAction } from './actions'
import { ModalEnvio } from './ModalEnvio'
import { PanelRapido, type ResultadoAnadir } from './PanelRapido'

export type DiaSemana = {
  fecha: string
  dia: string
  esHoy: boolean
  /** Día laborable según el calendario de la empresa. */
  laborable: boolean
  /** Motivo ya formateado: `Fin de semana`, `Festivo: ...`, `Vacaciones`. */
  motivo: string | null
  horasTeoricasMin: number | null
  /** Ausencia aprobada del día; en jornada completa el día ya no es laborable. */
  ausencia: { nombre: string; minutos: number | null } | null
}

type Props = {
  isoYear: number
  isoWeek: number
  dias: DiaSemana[]
  grupos: GrupoProyecto[]
  inicial: Record<string, string>
  versionInicial: number
  estado: EstadoParte
  motivoRechazo: string | null
  editable: boolean
  navegacion: { anterior: string; siguiente: string; actual: string }
  nombreEmpleado: string
  calendario: { capacidadMin: number | null; porDefecto: boolean }
}

function clave(fecha: string, tareaId: string): string {
  return `${fecha}|${tareaId}`
}

function ubicacionCelda(dias: DiaSemana[], fecha: string, tarea: string | undefined): string {
  const dia = dias.find((candidato) => candidato.fecha === fecha)
  const texto = dia ? `${dia.dia} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : fecha
  return tarea ? `${texto} · ${tarea}` : texto
}

/**
 * Misma regla que aplica el dominio al guardar: formato válido y como máximo
 * 24 horas por imputación. Validar aquí evita un viaje al servidor que solo
 * puede terminar en error.
 */
function errorDeCelda(texto: string): string | null {
  const parseado = horasAMinutos(texto)
  if (!parseado.ok) return parseado.error
  return parseado.minutos > MINUTOS_POR_DIA ? 'No se pueden imputar más de 24 horas en un día' : null
}

function moverFoco(actual: HTMLInputElement, delta: number) {
  const celdas = Array.from(document.querySelectorAll<HTMLInputElement>('[data-celda]')).filter(
    (celda) => celda.offsetParent !== null,
  )
  const indice = celdas.indexOf(actual)
  const siguiente = indice >= 0 ? celdas[indice + delta] : undefined
  if (siguiente) {
    siguiente.focus()
    siguiente.select()
  }
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
  calendario,
}: Props) {
  const router = useRouter()
  const [valores, setValores] = useState<Record<string, string>>(inicial)
  const [version, setVersion] = useState(versionInicial)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [hayConflicto, setHayConflicto] = useState(false)
  const [hayCambios, setHayCambios] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [resaltadas, setResaltadas] = useState<ReadonlySet<string>>(() => new Set())
  const [deshacer, setDeshacer] = useState<Record<string, string> | null>(null)
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
        error: errorDeCelda(texto),
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

  const diasConExceso = useMemo(
    () =>
      Object.entries(totalDia)
        .filter(([, minutos]) => minutos > MINUTOS_POR_DIA)
        .map(([fecha]) => fecha),
    [totalDia],
  )

  const nombresTarea = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const grupo of grupos) {
      for (const tarea of grupo.tareas) mapa.set(tarea.tareaId, tarea.tareaNombre)
    }
    return mapa
  }, [grupos])

  const totalTarea = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const celda of celdas) {
      mapa[celda.tareaId] = (mapa[celda.tareaId] ?? 0) + celda.minutos
    }
    return mapa
  }, [celdas])

  const errorValidacion = useMemo<{ ubicacion: string; mensaje: string } | null>(() => {
    const celda = celdas.find((candidata) => candidata.error !== null)
    if (celda) {
      return {
        ubicacion: ubicacionCelda(dias, celda.fecha, nombresTarea.get(celda.tareaId)),
        mensaje: celda.error ?? '',
      }
    }
    const fecha = diasConExceso[0]
    if (fecha) {
      return {
        ubicacion: ubicacionCelda(dias, fecha, undefined),
        mensaje: 'La suma del día supera las 24 horas',
      }
    }
    return null
  }, [celdas, dias, diasConExceso, nombresTarea])

  const total = sumarMinutos(celdas.map((celda) => celda.minutos))
  const diasConHoras = useMemo(
    () => new Set(celdas.filter((celda) => celda.texto.trim() !== '').map((celda) => celda.fecha)),
    [celdas],
  )
  const permiteDia = useMemo(() => {
    const mapa: Record<string, boolean> = {}
    for (const dia of dias) mapa[dia.fecha] = dia.laborable || diasConHoras.has(dia.fecha)
    return mapa
  }, [dias, diasConHoras])

  const avisos: string[] = []
  for (const dia of dias) {
    if ((totalDia[dia.fecha] ?? 0) > 12 * 60) avisos.push(`${dia.dia} supera 12 horas`)
  }
  if (total > 48 * 60) avisos.push('La semana supera 48 horas')
  const hayErrores = celdas.some((celda) => celda.error !== null)
  const desviacion = calendario.capacidadMin === null ? null : total - calendario.capacidadMin

  // Con un valor inválido o un conflicto de versión no se permite guardar:
  // el parte quedaría con datos erróneos o sobre una versión obsoleta.
  const guardadoBloqueado = hayErrores || hayConflicto || diasConExceso.length > 0

  const guardar = useCallback(
    async (silencioso = false): Promise<number | null> => {
      if (hayErrores) {
        setError('Corrige las celdas marcadas antes de guardar')
        return null
      }

      setGuardando(true)
      setError('')
      setHayConflicto(false)
      if (!silencioso) setMensaje('')

      const filas = celdas
        .filter((celda) => celda.minutos > 0)
        .map((celda) => ({ fecha: celda.fecha, tareaId: celda.tareaId, minutos: celda.minutos }))

      const edicionAlGuardar = ediciones.current
      const respuesta = await guardarSemanaAction({ isoYear, isoWeek, version, filas })
      setGuardando(false)

      if (!respuesta.success) {
        setError(respuesta.error.message)
        setHayConflicto(respuesta.error.code === 'CONFLICTO_VERSION')
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
    // Un error del servidor queda visible hasta que el usuario cambie un valor:
    // así no se repite el envío fallido ni parpadea el aviso.
    if (!editable || !hayCambios || hayErrores || guardando || error !== '') return
    const temporizador = setTimeout(() => {
      void guardar(true)
    }, 900)
    return () => clearTimeout(temporizador)
  }, [valores, hayCambios, hayErrores, editable, guardando, guardar, error])

  useEffect(() => {
    if (resaltadas.size === 0) return
    const temporizador = setTimeout(() => setResaltadas(new Set()), 2500)
    return () => clearTimeout(temporizador)
  }, [resaltadas])

  function cambiar(fecha: string, tareaId: string, texto: string) {
    ediciones.current += 1
    setValores((anterior) => ({ ...anterior, [clave(fecha, tareaId)]: texto }))
    setHayCambios(true)
    setMensaje('')
    // Al editar se descarta el error anterior, salvo un conflicto de versión:
    // ese solo se resuelve recargando la página.
    if (!hayConflicto) setError('')
  }

  function anadirRapido(fecha: string, tareaId: string, minutos: number): ResultadoAnadir {
    const llave = clave(fecha, tareaId)
    const actual = horasAMinutos(valores[llave] ?? '')

    const dia = dias.find((candidato) => candidato.fecha === fecha)
    if (dia && !dia.laborable && !diasConHoras.has(fecha)) {
      return {
        ok: false,
        error: `El ${dia.dia} no es laborable${dia.motivo ? ` (${dia.motivo})` : ''}. Si hubo trabajo, pide a administración que lo marque como laborable.`,
      }
    }

    if (!actual.ok) {
      return {
        ok: false,
        error: `Esa celda tiene un valor no válido. Corrígelo antes de sumar horas.`,
      }
    }

    const nuevoTotalDia = (totalDia[fecha] ?? 0) + minutos
    if (nuevoTotalDia > 24 * 60) {
      return { ok: false, error: 'Ese día superaría las 24 horas. Revisa las horas antes de añadir.' }
    }

    const nuevoTotalCelda = actual.minutos + minutos
    if (nuevoTotalCelda > 24 * 60) {
      return { ok: false, error: 'Una tarea no puede superar las 24 horas en un día.' }
    }

    ediciones.current += 1
    setDeshacer({ [llave]: valores[llave] ?? '' })
    setValores((anterior) => ({ ...anterior, [llave]: aTextoEditable(nuevoTotalCelda) }))
    setHayCambios(true)
    setMensaje('')
    setError('')
    setResaltadas(new Set([llave]))

    return {
      ok: true,
      mensaje: `Añadido ${formatearHorasReloj(minutos)} al ${dia?.dia ?? fecha}. Total del día: ${formatearHorasReloj(nuevoTotalDia)}.`,
    }
  }

  function deshacerUltimo() {
    if (!deshacer) return
    ediciones.current += 1
    setValores((anterior) => ({ ...anterior, ...deshacer }))
    setHayCambios(true)
    setDeshacer(null)
    setResaltadas(new Set())
    setMensaje('')
  }

  /**
   * Copia las horas indicadas a la tarea elegida en los días laborables que
   * sigan vacíos. Nunca sobrescribe un día con horas ni toca el fin de semana,
   * de modo que se puede rellenar la semana y después ajustar un día suelto.
   */
  function rellenarSemana(tareaId: string, minutos: number): ResultadoAnadir {
    if (minutos <= 0) {
      return { ok: false, error: 'Escribe o elige las horas antes de rellenar la semana' }
    }
    if (minutos > MINUTOS_POR_DIA) {
      return { ok: false, error: 'Una tarea no puede superar las 24 horas en un día.' }
    }

    const laborables = dias.filter((dia) => dia.laborable)
    if (laborables.length === 0) {
      return { ok: false, error: 'Esta semana no tiene días laborables que rellenar.' }
    }

    const diasConHoras = new Set(
      celdas.filter((celda) => celda.texto.trim() !== '').map((celda) => celda.fecha),
    )
    const vacios = laborables.filter((dia) => !diasConHoras.has(dia.fecha))
    const ocupados = laborables.length - vacios.length

    if (vacios.length === 0) {
      return {
        ok: true,
        mensaje: `No hay días laborables vacíos: los ${laborables.length} ya tienen horas.`,
      }
    }

    const texto = aTextoEditable(minutos)
    const anteriores: Record<string, string> = {}
    for (const dia of vacios) {
      const llave = clave(dia.fecha, tareaId)
      anteriores[llave] = valores[llave] ?? ''
    }

    ediciones.current += 1
    setDeshacer(anteriores)
    setValores((anterior) => {
      const siguiente = { ...anterior }
      for (const llave of Object.keys(anteriores)) siguiente[llave] = texto
      return siguiente
    })
    setHayCambios(true)
    setMensaje('')
    setError('')
    setResaltadas(new Set(Object.keys(anteriores)))

    const yaTenían = ocupados === 0 ? '' : ` ${ocupados} ya tenían horas.`
    const rellenado =
      vacios.length === 1
        ? `Rellenado 1 día laborable con ${formatearHorasReloj(minutos)}.`
        : `Rellenados ${vacios.length} días laborables con ${formatearHorasReloj(minutos)}.`
    return {
      ok: true,
      mensaje: `${rellenado}${yaTenían}`,
    }
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

      setModalAbierto(false)
      router.refresh()
    })
  }

  const deshabilitado = !editable
  const diaInicial = dias.find((dia) => dia.esHoy)?.fecha ?? dias[0]?.fecha ?? ''

  return (
    <section className="space-y-4 pb-28 lg:pb-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mi semana</h1>
          <p className="text-sm text-slate-600">
            {nombreEmpleado} · semana {isoWeek} de {isoYear}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <strong>Parte rechazado.</strong> {motivoRechazo} Corrige lo indicado y vuelve a enviarlo.
        </div>
      ) : null}

      {estado === 'ENVIADO' ? (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Parte enviado y pendiente de revisión. No se puede editar: si hay un error, pide a tu encargado que lo
          reabra.
        </div>
      ) : null}

      {estado === 'APROBADO' ? (
        <div role="status" className="rounded-md border border-acento-200 bg-acento-50 px-4 py-3 text-sm text-acento-900">
          Parte aprobado. Si necesitas un cambio, pide al encargado o al administrador que lo reabra.
        </div>
      ) : null}

      {estado === 'BLOQUEADO' ? (
        <div role="status" className="rounded-md border border-marca-200 bg-marca-50 px-4 py-3 text-sm text-marca-900">
          Parte aprobado y bloqueado por el cierre del periodo. Para corregirlo, administración debe reabrir el
          periodo en Cierres.
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
          {editable && diaInicial ? (
            <PanelRapido
              dias={dias}
              grupos={grupos}
              diaInicial={diaInicial}
              deshabilitado={deshabilitado}
              puedeDeshacer={deshacer !== null}
              onAnadir={anadirRapido}
              onRellenarSemana={rellenarSemana}
              onDeshacer={deshacerUltimo}
            />
          ) : null}

          <div className="hidden flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 lg:flex">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-5 w-9 rounded border border-dashed border-slate-400 bg-white"
              />
              Casilla libre: escribe las horas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-5 w-9 rounded border border-slate-400 bg-white text-center text-[11px] leading-5 font-medium"
              >
                7:30
              </span>
              Horas guardadas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-5 w-2 rounded bg-acento-200" />
              Día de hoy
            </span>
            {editable ? <span className="text-slate-500">Puedes escribir 7,5 · 7.5 · 7:30</span> : null}
          </div>

          <div className="tarjeta hidden max-h-[calc(100dvh-11rem)] overflow-auto lg:block">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-slate-200 bg-marca-50">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-56 border-r border-marca-200 bg-marca-50 px-3 py-2 text-left font-semibold text-marca-900"
                  >
                    Proyecto / tarea
                  </th>
                  {dias.map((dia) => (
                    <th
                      key={dia.fecha}
                      scope="col"
                      title={dia.motivo ?? undefined}
                      className={`w-20 border-l border-marca-100 px-2 py-2 text-center font-semibold ${
                        dia.esHoy ? 'bg-acento-100 text-marca-900' : dia.laborable ? 'text-slate-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <span className="block text-xs uppercase">{dia.dia}</span>
                      <span className="block text-[11px] font-normal text-slate-500">
                        {dia.fecha.slice(8, 10)}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[10px] font-semibold ${
                          dia.laborable ? 'text-acento-800' : 'text-slate-400'
                        }`}
                        title={dia.ausencia?.nombre ?? undefined}
                      >
                        {dia.ausencia
                          ? dia.ausencia.nombre
                          : dia.laborable
                            ? dia.esHoy
                              ? 'hoy'
                              : '\u00a0'
                            : 'libre'}
                      </span>
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="w-24 border-l border-marca-200 px-2 py-2 text-right font-semibold text-slate-700"
                  >
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
                    deshabilitado={deshabilitado}
                    resaltadas={resaltadas}
                    permiteDia={permiteDia}
                    cambiar={cambiar}
                  />
                ))}
                <tr className="border-t-2 border-slate-300 bg-marca-50 font-semibold">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-r border-marca-200 bg-marca-50 px-3 py-2 text-left"
                  >
                    Total día
                  </th>
                  {dias.map((dia) => (
                    <td
                      key={dia.fecha}
                      className={`border-l border-marca-100 px-2 py-2 text-center ${
                        (totalDia[dia.fecha] ?? 0) > 12 * 60 ? 'text-amber-700' : ''
                      }`}
                    >
                      {totalDia[dia.fecha] ? formatearHorasReloj(totalDia[dia.fecha] ?? 0) : '—'}
                    </td>
                  ))}
                  <td className="border-l border-marca-200 px-2 py-2 text-right">{formatearHorasReloj(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {dias.map((dia) => (
              <TarjetaDia
                key={dia.fecha}
                dia={dia}
                grupos={grupos}
                valores={valores}
                totalDia={totalDia[dia.fecha] ?? 0}
                deshabilitado={deshabilitado}
                resaltadas={resaltadas}
                permite={permiteDia[dia.fecha] ?? true}
                cambiar={cambiar}
                tieneError={
                  diasConExceso.includes(dia.fecha) ||
                  celdas.some((celda) => celda.fecha === dia.fecha && celda.error !== null)
                }
              />
            ))}
          </div>

          {calendario.capacidadMin !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>
                Jornada teórica: <strong className="text-slate-800">{formatearHorasReloj(calendario.capacidadMin)}</strong>
                {' · '}registradas <strong className="text-slate-800">{formatearHorasReloj(total)}</strong>
              </span>
              {desviacion !== null && desviacion !== 0 ? (
                <span className={desviacion > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-marca-700'}>
                  {desviacion > 0 ? '+' : '-'}
                  {formatearHorasReloj(Math.abs(desviacion))} {desviacion > 0 ? 'por encima' : 'por debajo'}
                </span>
              ) : (
                <span className="font-semibold text-acento-800">En jornada</span>
              )}
            </div>
          ) : calendario.porDefecto ? (
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
              Sin calendario laboral configurado: se aplica lunes a viernes. Administración puede definir festivos y
              jornada teórica en Calendario.
            </p>
          ) : null}
        </>
      )}

      {avisos.length > 0 ? (
        <ul className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      ) : null}

      {errorValidacion ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span className="font-semibold">{errorValidacion.ubicacion}</span>: {errorValidacion.mensaje}. Corrige el
          valor para poder guardar.
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          {hayConflicto ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-semibold underline hover:text-red-900"
            >
              Recargar la página
            </button>
          ) : null}
        </div>
      ) : null}

      {editable ? (
        <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <EstadoBadge estado={estado} />
            <span>{guardando ? 'Guardando...' : mensaje}</span>
            {hayCambios && !guardando ? <span className="text-xs text-amber-700">cambios sin guardar</span> : null}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando || guardadoBloqueado}
              className="boton-secundario"
            >
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={() => {
                setError('')
                setModalAbierto(true)
              }}
              disabled={pendienteEnvio || guardando || guardadoBloqueado || total === 0}
              className="boton-primario"
            >
              Revisar y enviar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <EstadoBadge estado={estado} />
          <span className="text-sm text-slate-600">Total de la semana: {formatearHorasReloj(total)}</span>
        </div>
      )}

      <p className="hidden text-xs text-slate-500 lg:block">
        Puedes escribir 7,5 · 7.5 · 7:30. Pulsa Intro para pasar a la celda siguiente. El parte pasa a{' '}
        {etiquetaEstado('ENVIADO').toLowerCase()} cuando lo envías y queda bloqueado hasta la revisión.
      </p>

      {editable ? (
        <div className="no-imprimir fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`truncate text-xs ${hayErrores ? 'text-red-600' : 'text-slate-500'}`}>
                {guardando
                  ? 'Guardando...'
                  : hayErrores
                    ? 'Corrige las horas marcadas'
                    : mensaje || (hayCambios ? 'Cambios sin guardar' : 'Total semana')}
              </p>
              <p className="text-lg font-bold text-marca-900">{formatearHorasReloj(total)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={guardando || guardadoBloqueado}
                className="boton-secundario px-3 py-1.5 text-xs"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setModalAbierto(true)
                }}
                disabled={pendienteEnvio || guardando || guardadoBloqueado || total === 0}
                className="boton-primario px-3 py-1.5 text-xs"
              >
                Revisar y enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalAbierto ? (
        <ModalEnvio
          pendiente={pendienteEnvio}
          dias={dias}
          grupos={grupos}
          celdas={celdas}
          avisos={avisos}
          total={total}
          onCerrar={() => setModalAbierto(false)}
          onConfirmar={enviar}
        />
      ) : null}
    </section>
  )
}

function GrupoFilas({
  grupo,
  dias,
  valores,
  totalTarea,
  deshabilitado,
  resaltadas,
  permiteDia,
  cambiar,
}: {
  grupo: GrupoProyecto
  dias: DiaSemana[]
  valores: Record<string, string>
  totalTarea: Record<string, number>
  deshabilitado: boolean
  resaltadas: ReadonlySet<string>
  permiteDia: Record<string, boolean>
  cambiar: (fecha: string, tareaId: string, texto: string) => void
}) {
  return (
    <>
      <tr className="bg-white">
        <th
          scope="rowgroup"
          colSpan={dias.length + 2}
          className="border-t-2 border-marca-100 bg-white px-3 pt-3 pb-1.5 text-left text-xs font-semibold tracking-wide text-marca-800 uppercase"
        >
          {grupo.proyectoCodigo} · {grupo.proyectoNombre}
        </th>
      </tr>
      {grupo.tareas.map((tarea) => (
        <tr key={tarea.tareaId} className="border-b border-slate-100 last:border-0">
          <th
            scope="row"
            className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-1.5 text-left font-normal"
          >
            <span className="block text-sm text-slate-800">{tarea.tareaNombre}</span>
            <span className="block text-[11px] text-slate-500">{tarea.tareaCodigo}</span>
          </th>
          {dias.map((dia) => {
            const llave = clave(dia.fecha, tarea.tareaId)
            const texto = valores[llave] ?? ''
            const errorCelda = errorDeCelda(texto)
            const invalida = texto !== '' && errorCelda !== null
            const destacada = resaltadas.has(llave)
            const permite = permiteDia[dia.fecha] ?? true
            const bloqueada = deshabilitado || !permite

            const aspecto = invalida
              ? 'border-red-400 bg-red-50 text-red-800 focus:border-red-500 focus:ring-red-200'
              : destacada
                ? 'border-acento-500 bg-acento-100 ring-2 ring-acento-400'
                : deshabilitado
                  ? 'border-transparent bg-transparent text-slate-500'
                  : !permite
                    ? 'border-transparent bg-slate-50 text-slate-400'
                    : texto !== ''
                      ? 'border-slate-300 bg-white text-slate-900 focus:border-marca-500 focus:ring-marca-200'
                      : 'border-dashed border-slate-400 bg-white text-slate-900 hover:border-marca-400 hover:bg-marca-50 focus:border-marca-500 focus:bg-white focus:ring-marca-200'

            return (
              <td
                key={dia.fecha}
                title={!dia.laborable ? (dia.motivo ?? undefined) : undefined}
                className={`border-l border-slate-100 px-1 py-1 ${dia.esHoy ? 'bg-acento-50' : ''} ${
                  dia.laborable ? '' : 'bg-slate-50/70'
                }`}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  data-celda={llave}
                  aria-label={`${grupo.proyectoCodigo} ${tarea.tareaNombre} ${dia.dia}`}
                  aria-invalid={invalida || undefined}
                  value={texto}
                  onChange={(evento) => cambiar(dia.fecha, tarea.tareaId, evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') {
                      evento.preventDefault()
                      moverFoco(evento.currentTarget, evento.shiftKey ? -1 : 1)
                    }
                  }}
                  disabled={bloqueada}
                  title={errorCelda ?? (!dia.laborable ? (dia.motivo ?? undefined) : undefined)}
                  placeholder={bloqueada ? '' : '0'}
                  className={`w-full rounded border px-1 py-1 text-center text-sm font-medium transition-colors placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-2 ${aspecto}`}
                />
              </td>
            )
          })}
          <td className="border-l border-slate-200 px-2 py-1 text-right text-sm font-medium text-slate-700">
            {totalTarea[tarea.tareaId] ? formatearHorasReloj(totalTarea[tarea.tareaId] ?? 0) : '—'}
          </td>
        </tr>
      ))}
      <tr className="border-b border-slate-200 bg-marca-50/60">
        <th
          scope="row"
          className="sticky left-0 z-10 border-r border-slate-200 bg-marca-50 px-3 py-1 text-left text-[11px] font-semibold text-marca-800"
        >
          Subtotal {grupo.proyectoCodigo}
        </th>
        {dias.map((dia) => {
          const minutos = grupo.tareas.reduce((suma, tarea) => {
            const parseado = horasAMinutos(valores[clave(dia.fecha, tarea.tareaId)] ?? '')
            return suma + (parseado.ok ? parseado.minutos : 0)
          }, 0)
          return (
            <td
              key={dia.fecha}
              className="border-l border-slate-100 px-2 py-1 text-center text-[11px] font-medium text-marca-800"
            >
              {minutos > 0 ? formatearHorasReloj(minutos) : '·'}
            </td>
          )
        })}
        <td className="border-l border-slate-200 px-2 py-1 text-right text-[11px] font-semibold text-marca-800">
          {grupo.tareas.reduce((suma, tarea) => suma + (totalTarea[tarea.tareaId] ?? 0), 0) > 0
            ? formatearHorasReloj(grupo.tareas.reduce((suma, tarea) => suma + (totalTarea[tarea.tareaId] ?? 0), 0))
            : '—'}
        </td>
      </tr>
    </>
  )
}

function TarjetaDia({
  dia,
  grupos,
  valores,
  totalDia,
  deshabilitado,
  resaltadas,
  cambiar,
  tieneError,
  permite,
}: {
  dia: DiaSemana
  grupos: GrupoProyecto[]
  valores: Record<string, string>
  totalDia: number
  deshabilitado: boolean
  resaltadas: ReadonlySet<string>
  cambiar: (fecha: string, tareaId: string, texto: string) => void
  tieneError: boolean
  /** Día laborable o con horas ya registradas que se pueden corregir. */
  permite: boolean
}) {
  // Sin decisión explícita del usuario, el día de hoy y cualquier día con un
  // valor inválido se muestran abiertos: en móvil la celda vive dentro de la
  // tarjeta y no se podría corregir si quedara plegada.
  const [abiertaManual, setAbiertaManual] = useState<boolean | null>(null)
  const abierta = abiertaManual ?? (dia.esHoy || tieneError)

  return (
    <div className={`tarjeta p-3 ${dia.laborable ? '' : 'bg-slate-50'}`}>
      <button
        type="button"
        onClick={() => setAbiertaManual(!abierta)}
        aria-expanded={abierta}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <h2 className={`text-sm font-semibold capitalize ${dia.esHoy ? 'text-acento-800' : dia.laborable ? 'text-slate-800' : 'text-slate-500'}`}>
          {dia.dia} {dia.fecha.slice(8, 10)}/{dia.fecha.slice(5, 7)}
          {dia.esHoy ? <span className="ml-2 text-[11px] font-normal text-acento-700">hoy</span> : null}
          {!dia.laborable ? (
            <span className="ml-2 text-[11px] font-normal text-slate-400">{dia.motivo ?? 'no laborable'}</span>
          ) : null}
          {dia.ausencia ? (
            <span className="ml-2 text-[11px] font-normal text-amber-700">{dia.ausencia.nombre}</span>
          ) : null}
        </h2>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {formatearHorasReloj(totalDia)}
          <span aria-hidden="true">{abierta ? '▾' : '▸'}</span>
        </span>
      </button>

      {abierta ? (
        <div className="mt-2 space-y-2">
          {!permite ? (
            <p className="rounded border border-dashed border-slate-300 px-2 py-1.5 text-[11px] text-slate-500">
              Día no laborable. No se pueden añadir horas nuevas.
            </p>
          ) : null}
          {grupos.flatMap((grupo) =>
            grupo.tareas.map((tarea) => {
              const llave = clave(dia.fecha, tarea.tareaId)
              const elementoResaltado = resaltadas.has(llave)
              const texto = valores[llave] ?? ''
              const errorCelda = errorDeCelda(texto)
              return (
                <label key={llave} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-xs text-slate-600">
                    <span className="block truncate font-medium text-slate-800">{grupo.proyectoCodigo}</span>
                    <span className="block truncate">{tarea.tareaNombre}</span>
                  </span>
                  <input
                    inputMode="decimal"
                    type="text"
                    data-celda={llave}
                    aria-label={`${grupo.proyectoCodigo} ${tarea.tareaNombre} ${dia.dia}`}
                    aria-invalid={errorCelda !== null || undefined}
                    title={errorCelda ?? undefined}
                    value={texto}
                    onChange={(evento) => cambiar(dia.fecha, tarea.tareaId, evento.target.value)}
                    disabled={deshabilitado || !permite}
                    className={`campo h-11 w-24 text-center ${
                      elementoResaltado
                        ? 'border-acento-500 bg-acento-100 ring-2 ring-acento-400'
                        : errorCelda !== null
                          ? 'border-red-400 bg-red-50'
                          : ''
                    }`}
                    placeholder={permite ? '0' : ''}
                  />
                </label>
              )
            }),
          )}
        </div>
      ) : null}
    </div>
  )
}
