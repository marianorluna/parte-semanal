'use client'

import { useActionState } from 'react'
import { Select } from '@/components/Select'
import { anularAusenciaAction, solicitarAusenciaAction, type EstadoAusenciaUI } from './actions'

const inicial: EstadoAusenciaUI = {}

function Mensajes({ estado }: { estado: EstadoAusenciaUI }) {
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

export function FormularioSolicitud({
  tipos,
  hoy,
}: {
  tipos: { id: string; nombre: string }[]
  hoy: string
}) {
  const [estado, accion, pendiente] = useActionState(solicitarAusenciaAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <Select
        etiqueta="Tipo"
        name="tipoId"
        requerido
        classNameContenedor="sm:col-span-2"
        opciones={[
          { valor: '', etiqueta: 'Selecciona' },
          ...tipos.map((tipo) => ({ valor: tipo.id, etiqueta: tipo.nombre })),
        ]}
      />
      <label className="text-xs font-medium text-slate-600">
        Desde
        <input name="desde" type="date" required defaultValue={hoy} className="campo mt-1" />
        {estado.campo?.desde ? <span className="text-red-600">{estado.campo.desde}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600">
        Hasta
        <input name="hasta" type="date" required defaultValue={hoy} className="campo mt-1" />
        {estado.campo?.hasta ? <span className="text-red-600">{estado.campo.hasta}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600">
        Horas (opcional)
        <input name="horas" inputMode="decimal" className="campo mt-1" placeholder="Jornada completa" />
        {estado.campo?.minutos ? <span className="text-red-600">{estado.campo.minutos}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600 sm:col-span-3">
        Motivo
        <input name="motivo" className="campo mt-1" placeholder="Opcional" />
      </label>
      <p className="self-end text-xs text-slate-500 sm:col-span-4">
        Déjalo en jornada completa para vacaciones. Con horas, la rejilla reduce la jornada de ese
        día en lugar de bloquearlo.
      </p>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
      <div className="sm:col-span-4">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Solicitando...' : 'Solicitar ausencia'}
        </button>
      </div>
    </form>
  )
}

export function BotonAnular({ ausenciaId }: { ausenciaId: string }) {
  const [estado, accion, pendiente] = useActionState(anularAusenciaAction, inicial)

  return (
    <form action={accion} className="mt-2 space-y-1">
      <input type="hidden" name="ausenciaId" value={ausenciaId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="motivo"
          required
          minLength={5}
          className="campo w-full max-w-xs text-xs"
          placeholder="Motivo de la anulación"
        />
        <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
          {pendiente ? 'Anulando...' : 'Anular'}
        </button>
      </div>
      {estado.error ? <p className="text-xs text-red-700">{estado.error}</p> : null}
    </form>
  )
}
