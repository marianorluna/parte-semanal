'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import {
  FORMATOS_INFORME,
  TIPOS_INFORME,
  ETIQUETAS_TIPO_INFORME,
  type TipoInforme,
} from '@/modules/informes/domain/informe'
import { reintentarInformeAction, solicitarInformeAction, type EstadoInformes } from './actions'

const inicial: EstadoInformes = {}

function Mensajes({ estado }: { estado: EstadoInformes }) {
  return (
    <>
      {estado.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="rounded-md bg-acento-50 px-3 py-2 text-sm text-acento-800">
          {estado.ok}
        </p>
      ) : null}
    </>
  )
}

export function FormularioInforme({
  proyectos,
  hoy,
}: {
  proyectos: { id: string; codigo: string; nombre: string }[]
  hoy: string
}) {
  const [estado, accion, pendiente] = useActionState(solicitarInformeAction, inicial)
  const [tipo, setTipo] = useState<TipoInforme>('LIBRO_JORNADA')

  const esMensual = tipo === 'CERTIFICACION_MENSUAL'
  const anioActual = Number(hoy.slice(0, 4))
  const mesActual = Number(hoy.slice(5, 7))

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <Select
        etiqueta="Tipo de informe"
        name="tipo"
        valorInicial={tipo}
        onChange={(valor) => setTipo(valor as TipoInforme)}
        classNameContenedor="sm:col-span-2"
        opciones={TIPOS_INFORME.map((valor) => ({
          valor,
          etiqueta: ETIQUETAS_TIPO_INFORME[valor],
        }))}
      />
      <Select
        etiqueta="Formato"
        name="formato"
        valorInicial="XLSX"
        opciones={FORMATOS_INFORME.map((formato) => ({ valor: formato, etiqueta: formato }))}
      />

      {esMensual ? (
        <>
          <label className="text-xs font-medium text-slate-600">
            Año
            <input
              name="anio"
              type="number"
              min={2000}
              max={2100}
              defaultValue={anioActual}
              className="campo mt-1"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Mes
            <input
              name="mes"
              type="number"
              min={1}
              max={12}
              defaultValue={mesActual}
              className="campo mt-1"
            />
          </label>
        </>
      ) : (
        <>
          <label className="text-xs font-medium text-slate-600">
            Desde
            <input
              name="desde"
              type="date"
              defaultValue={`${hoy.slice(0, 8)}01`}
              className="campo mt-1"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Hasta
            <input name="hasta" type="date" defaultValue={hoy} className="campo mt-1" />
          </label>
        </>
      )}

      {tipo === 'COSTES_PROYECTO' ? (
        <Select
          etiqueta="Proyecto (opcional)"
          name="proyectoId"
          valorInicial=""
          classNameContenedor="sm:col-span-2"
          opciones={[
            { valor: '', etiqueta: 'Todos los proyectos' },
            ...proyectos.map((proyecto) => ({
              valor: proyecto.id,
              etiqueta: `${proyecto.codigo} · ${proyecto.nombre}`,
            })),
          ]}
        />
      ) : null}

      <div className="self-end">
        <button type="submit" disabled={pendiente} className="boton-primario w-full">
          {pendiente ? 'Enviando...' : 'Solicitar informe'}
        </button>
      </div>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function BotonReintentar({ informeId }: { informeId: string }) {  const [estado, accion, pendiente] = useActionState(reintentarInformeAction, inicial)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="informeId" value={informeId} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        {pendiente ? 'Reintentando...' : 'Reintentar'}
      </button>
      {estado.error ? <span className="ml-2 text-xs text-red-700">{estado.error}</span> : null}
    </form>
  )
}

/**
 * Refresca la lista mientras haya informes en cola. Evita que el usuario tenga
 * que recargar a mano y se detiene en cuanto todos terminan o fallan.
 */
export function AutoRefrescar({ activo }: { activo: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!activo) return
    const intervalo = window.setInterval(() => router.refresh(), 4_000)
    return () => window.clearInterval(intervalo)
  }, [activo, router])

  return null
}
