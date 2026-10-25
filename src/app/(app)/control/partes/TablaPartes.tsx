'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { EstadoParte } from '@/db/schema'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { EstadoBadge } from '@/components/EstadoBadge'
import { Icono } from '@/components/Iconos'
import { BotonIcono, EnlaceIcono } from '@/components/AccionesIcono'
import { aprobarLoteAction, aprobarParteAction, rechazarParteAction } from './actions'

export type FilaParte = {
  id: string
  version: number
  empleadoNombre: string
  empleadoCodigo: string
  totalMinutos: number
  estado: EstadoParte
  motivoRechazo: string | null
}

export function TablaPartes({ filas }: { filas: FilaParte[] }) {
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [motivo, setMotivo] = useState('')
  const [mostrarMotivo, setMostrarMotivo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const seleccionables = filas.filter((fila) => fila.estado === 'ENVIADO')

  function alternar(id: string) {
    setSeleccion((anterior) => {
      const copia = new Set(anterior)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })
  }

  function alternarTodos() {
    setSeleccion((anterior) => {
      if (anterior.size === seleccionables.length) return new Set()
      return new Set(seleccionables.map((fila) => fila.id))
    })
  }

  function seleccionadosPayload() {
    return filas.filter((fila) => seleccion.has(fila.id)).map((fila) => ({ parteId: fila.id, version: fila.version }))
  }

  async function aprobarSeleccion() {
    setOcupado(true)
    setError('')
    setMensaje('')

    const respuesta = await aprobarLoteAction({ partes: seleccionadosPayload() })
    setOcupado(false)

    if (!respuesta.success) {
      setError(respuesta.error.message)
      return
    }

    setMensaje(
      respuesta.data.aprobados > 0
        ? `${respuesta.data.aprobados} partes aprobados${respuesta.data.fallidos.length > 0 ? `, ${respuesta.data.fallidos.length} con error` : ''}`
        : 'No se pudo aprobar ninguno',
    )
    setSeleccion(new Set())
    router.refresh()
  }

  async function aprobarUno(fila: FilaParte) {
    setOcupado(true)
    setError('')
    const respuesta = await aprobarParteAction({ parteId: fila.id, version: fila.version })
    setOcupado(false)
    if (!respuesta.success) {
      setError(respuesta.error.message)
      return
    }
    router.refresh()
  }

  async function rechazarSeleccion() {
    if (motivo.trim().length < 5) {
      setError('Escribe un motivo de al menos 5 caracteres')
      return
    }

    setOcupado(true)
    setError('')
    setMensaje('')

    let rechazados = 0
    let fallidos = 0
    for (const fila of filas.filter((f) => seleccion.has(f.id))) {
      const respuesta = await rechazarParteAction({ parteId: fila.id, version: fila.version, motivo })
      if (respuesta.success) rechazados += 1
      else fallidos += 1
    }

    setOcupado(false)
    setMensaje(`${rechazados} rechazados${fallidos > 0 ? `, ${fallidos} con error` : ''}`)
    setSeleccion(new Set())
    setMostrarMotivo(false)
    setMotivo('')
    router.refresh()
  }

  const todosSeleccionados = seleccionables.length > 0 && seleccion.size === seleccionables.length

  return (
    <div className="space-y-3">
      {seleccion.size > 0 ? (
        <div className="tarjeta sticky top-14 z-10 flex flex-wrap items-center gap-2 border-acento-300 bg-acento-50 p-3 lg:top-24">
          <span className="text-sm font-semibold text-marca-900">{seleccion.size} seleccionados</span>
          <BotonIcono
            icono="check"
            etiqueta="Aprobar seleccionados"
            variante="primario"
            disabled={ocupado}
            onClick={() => void aprobarSeleccion()}
          />
          <BotonIcono
            icono="alerta"
            etiqueta="Rechazar seleccionados"
            variante="peligro"
            disabled={ocupado}
            onClick={() => setMostrarMotivo((v) => !v)}
          />
          {mostrarMotivo ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <input
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                placeholder="Motivo del rechazo (se guarda en auditoría)"
                className="campo flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => void rechazarSeleccion()}
                disabled={ocupado}
                className="boton-peligro boton-campo text-xs"
              >
                <Icono nombre="alerta" />
                Confirmar rechazo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {mensaje ? <p className="rounded-md bg-acento-50 px-3 py-2 text-sm text-acento-800">{mensaje}</p> : null}
      {error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="tarjeta hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos los enviados"
                  checked={todosSeleccionados}
                  onChange={alternarTodos}
                  disabled={seleccionables.length === 0}
                  className="h-[22px] w-[22px] cursor-pointer accent-marca-700"
                />
              </th>
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2">Horas</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar parte de ${fila.empleadoNombre}`}
                    checked={seleccion.has(fila.id)}
                    onChange={() => alternar(fila.id)}
                    disabled={fila.estado !== 'ENVIADO'}
                    className="h-[22px] w-[22px] cursor-pointer accent-marca-700"
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/control/partes/${fila.id}`} className="font-medium text-slate-900 hover:text-marca-700">
                    {fila.empleadoNombre}
                  </Link>
                  <span className="block text-xs text-slate-500">{fila.empleadoCodigo}</span>
                </td>
                <td className="px-3 py-2 font-mono">{formatearHorasReloj(fila.totalMinutos)}</td>
                <td className="px-3 py-2">
                  <EstadoBadge estado={fila.estado} />
                  {fila.motivoRechazo ? (
                    <span className="mt-1 block max-w-56 truncate text-xs text-red-700">{fila.motivoRechazo}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <EnlaceIcono
                      href={`/control/partes/${fila.id}`}
                      icono="lupa"
                      etiqueta="Ver"
                      variante="secundario"
                      className="min-h-9 px-2 text-xs"
                    />
                    {fila.estado === 'ENVIADO' ? (
                      <BotonIcono
                        icono="check"
                        etiqueta="Aprobar"
                        variante="primario"
                        disabled={ocupado}
                        onClick={() => void aprobarUno(fila)}
                        className="min-h-9 px-2 text-xs"
                      />
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
          <li key={fila.id} className="tarjeta p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={`Seleccionar parte de ${fila.empleadoNombre}`}
                checked={seleccion.has(fila.id)}
                onChange={() => alternar(fila.id)}
                disabled={fila.estado !== 'ENVIADO'}
                className="mt-1 h-[22px] w-[22px] shrink-0 cursor-pointer accent-marca-700"
              />
              <div className="min-w-0 flex-1">
                <Link href={`/control/partes/${fila.id}`} className="block font-medium text-slate-900 hover:text-marca-700">
                  <span className="block truncate">{fila.empleadoNombre}</span>
                  <span className="block text-xs font-normal text-slate-500">{fila.empleadoCodigo}</span>
                </Link>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-slate-800">{formatearHorasReloj(fila.totalMinutos)}</span>
                  <EstadoBadge estado={fila.estado} />
                </div>

                {fila.motivoRechazo ? (
                  <p className="mt-1 line-clamp-2 text-xs text-red-700">{fila.motivoRechazo}</p>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/control/partes/${fila.id}`}
                    className="boton-secundario flex-1 px-2 py-1.5 text-xs"
                  >
                    <Icono nombre="lupa" className="h-4 w-4" />
                    Ver
                  </Link>
                  {fila.estado === 'ENVIADO' ? (
                    <button
                      type="button"
                      onClick={() => void aprobarUno(fila)}
                      disabled={ocupado}
                      className="boton-primario flex-1 px-2 py-1.5 text-xs"
                    >
                      <Icono nombre="check" className="h-4 w-4" />
                      Aprobar
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
