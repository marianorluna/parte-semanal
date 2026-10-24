'use client'

import { useActionState } from 'react'
import { Select } from '@/components/Select'
import {
  actualizarTipoAusenciaAction,
  alternarTipoAusenciaAction,
  crearTipoAusenciaAction,
  guardarSaldoAction,
  type EstadoAdminAusencias,
} from './actions'

const inicial: EstadoAdminAusencias = {}

function Mensajes({ estado }: { estado: EstadoAdminAusencias }) {
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

function CamposTipo({ estado, datos }: { estado: EstadoAdminAusencias; datos?: { codigo: string; nombre: string; computaSaldo: boolean; requiereAprobacion: boolean } }) {
  return (
    <>
      <label className="text-xs font-medium text-slate-600">
        Código
        <input name="codigo" required defaultValue={datos?.codigo} className="campo mt-1" placeholder="VAC" />
        {estado.campo?.codigo ? <span className="text-red-600">{estado.campo.codigo}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">
        Nombre
        <input name="nombre" required defaultValue={datos?.nombre} className="campo mt-1" placeholder="Vacaciones" />
        {estado.campo?.nombre ? <span className="text-red-600">{estado.campo.nombre}</span> : null}
      </label>
      <label className="flex items-center gap-2 self-end text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          name="computaSaldo"
          defaultChecked={datos?.computaSaldo ?? false}
          className="h-4 w-4"
        />
        Computa saldo
      </label>
      <label className="flex items-center gap-2 self-end text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          name="requiereAprobacion"
          defaultChecked={datos?.requiereAprobacion ?? true}
          className="h-4 w-4"
        />
        Requiere aprobación
      </label>
    </>
  )
}

export function FormularioTipo() {
  const [estado, accion, pendiente] = useActionState(crearTipoAusenciaAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-5">
      <CamposTipo estado={estado} />
      <div className="self-end">
        <button type="submit" disabled={pendiente} className="boton-primario w-full">
          {pendiente ? 'Creando...' : 'Crear tipo'}
        </button>
      </div>
      <div className="sm:col-span-5">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function FormularioEdicionTipo({
  tipo,
}: {
  tipo: { id: string; codigo: string; nombre: string; computaSaldo: boolean; requiereAprobacion: boolean }
}) {
  const [estado, accion, pendiente] = useActionState(actualizarTipoAusenciaAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-5">
      <input type="hidden" name="tipoId" value={tipo.id} />
      <CamposTipo estado={estado} datos={tipo} />
      <div className="self-end">
        <button type="submit" disabled={pendiente} className="boton-secundario w-full">
          {pendiente ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
      <div className="sm:col-span-5">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function BotonAlternarTipo({ tipoId, activo }: { tipoId: string; activo: boolean }) {
  const [estado, accion, pendiente] = useActionState(alternarTipoAusenciaAction, inicial)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="tipoId" value={tipoId} />
      <input type="hidden" name="activo" value={activo ? 'false' : 'true'} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        {activo ? 'Desactivar' : 'Activar'}
      </button>
      {estado.error ? <span className="ml-2 text-xs text-red-700">{estado.error}</span> : null}
    </form>
  )
}

export function FormularioSaldo({
  empleados,
  anio,
}: {
  empleados: { id: string; codigo: string; nombre: string }[]
  anio: number
}) {
  const [estado, accion, pendiente] = useActionState(guardarSaldoAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-5">
      <Select
        etiqueta="Empleado"
        name="empleadoId"
        requerido
        classNameContenedor="sm:col-span-2"
        opciones={[
          { valor: '', etiqueta: 'Selecciona' },
          ...empleados.map((empleado) => ({
            valor: empleado.id,
            etiqueta: `${empleado.codigo} · ${empleado.nombre}`,
          })),
        ]}
      />
      <label className="text-xs font-medium text-slate-600">
        Año
        <input name="anio" type="number" min={2000} max={2100} defaultValue={anio} required className="campo mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Horas asignadas
        <input name="horasAsignadas" inputMode="decimal" required className="campo mt-1" placeholder="120" />
        {estado.campo?.minutosAsignados ? (
          <span className="text-red-600">{estado.campo.minutosAsignados}</span>
        ) : null}
      </label>
      <label className="text-xs font-medium text-slate-600">
        Horas arrastradas
        <input name="horasArrastradas" inputMode="decimal" defaultValue="0" className="campo mt-1" />
      </label>
      <div className="sm:col-span-5">
        <Mensajes estado={estado} />
      </div>
      <div className="sm:col-span-5">
        <button type="submit" disabled={pendiente} className="boton-secundario">
          {pendiente ? 'Guardando...' : 'Guardar saldo'}
        </button>
      </div>
    </form>
  )
}
