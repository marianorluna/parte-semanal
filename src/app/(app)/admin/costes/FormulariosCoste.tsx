'use client'

import { useActionState } from 'react'
import { Select } from '@/components/Select'
import {
  actualizarTarifaAction,
  crearPresupuestoAction,
  crearTarifaAction,
  eliminarTarifaAction,
  type EstadoCoste,
} from './actions'

const inicial: EstadoCoste = {}

function Mensajes({ estado }: { estado: EstadoCoste }) {
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

type EmpleadoOpcion = { id: string; codigo: string; nombre: string }

function CamposTarifa({
  empleados,
  hoy,
  tarifa,
}: {
  empleados: EmpleadoOpcion[]
  hoy: string
  tarifa?: {
    empleadoId: string | null
    categoria: string | null
    importeHoraCents: number
    desde: string
    hasta: string | null
    activo: boolean
  }
}) {
  return (
    <>
      <Select
        etiqueta="Ámbito"
        name="ambito"
        valorInicial={tarifa?.empleadoId ? 'EMPLEADO' : tarifa ? 'CATEGORIA' : 'EMPLEADO'}
        opciones={[
          { valor: 'EMPLEADO', etiqueta: 'Empleado' },
          { valor: 'CATEGORIA', etiqueta: 'Categoría' },
        ]}
      />
      <Select
        etiqueta="Empleado"
        name="empleadoId"
        valorInicial={tarifa?.empleadoId ?? ''}
        opciones={[
          { valor: '', etiqueta: 'Ninguno' },
          ...empleados.map((empleado) => ({
            valor: empleado.id,
            etiqueta: `${empleado.codigo} · ${empleado.nombre}`,
          })),
        ]}
      />
      <label className="text-xs font-medium text-slate-600">
        Categoría
        <input
          name="categoria"
          defaultValue={tarifa?.categoria ?? ''}
          className="campo mt-1"
          placeholder="Oficial 1ª"
        />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Importe por hora (€)
        <input
          name="importe"
          inputMode="decimal"
          required
          defaultValue={
            tarifa ? (tarifa.importeHoraCents / 100).toFixed(2).replace('.', ',') : ''
          }
          className="campo mt-1"
          placeholder="18,50"
        />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Desde
        <input name="desde" type="date" required defaultValue={tarifa?.desde ?? hoy} className="campo mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Hasta (opcional)
        <input name="hasta" type="date" defaultValue={tarifa?.hasta ?? ''} className="campo mt-1" />
      </label>
      <label className="flex items-center gap-2 self-end text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          name="activo"
          value="on"
          defaultChecked={tarifa?.activo ?? true}
          className="h-4 w-4"
        />
        Activa
      </label>
    </>
  )
}

export function FormularioTarifa({ empleados, hoy }: { empleados: EmpleadoOpcion[]; hoy: string }) {
  const [estado, accion, pendiente] = useActionState(crearTarifaAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <CamposTarifa empleados={empleados} hoy={hoy} />
      <div className="self-end">
        <button type="submit" disabled={pendiente} className="boton-primario w-full">
          {pendiente ? 'Creando...' : 'Añadir tarifa'}
        </button>
      </div>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function FormularioEdicionTarifa({
  empleados,
  hoy,
  tarifa,
}: {
  empleados: EmpleadoOpcion[]
  hoy: string
  tarifa: {
    id: string
    empleadoId: string | null
    categoria: string | null
    importeHoraCents: number
    desde: string
    hasta: string | null
    activo: boolean
  }
}) {
  const [estado, accion, pendiente] = useActionState(actualizarTarifaAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="tarifaId" value={tarifa.id} />
      <CamposTarifa empleados={empleados} hoy={hoy} tarifa={tarifa} />
      <div className="self-end">
        <button type="submit" disabled={pendiente} className="boton-secundario w-full">
          {pendiente ? 'Guardando...' : 'Guardar tarifa'}
        </button>
      </div>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function BotonEliminarTarifa({ tarifaId }: { tarifaId: string }) {
  const [estado, accion, pendiente] = useActionState(eliminarTarifaAction, inicial)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="tarifaId" value={tarifaId} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        Eliminar
      </button>
      {estado.error ? <span className="ml-2 text-xs text-red-700">{estado.error}</span> : null}
    </form>
  )
}

export function FormularioPresupuesto({
  proyectos,
}: {
  proyectos: { id: string; codigo: string; nombre: string }[]
}) {
  const [estado, accion, pendiente] = useActionState(crearPresupuestoAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-5">
      <Select
        etiqueta="Proyecto"
        name="proyectoId"
        requerido
        classNameContenedor="sm:col-span-2"
        opciones={[
          { valor: '', etiqueta: 'Selecciona' },
          ...proyectos.map((proyecto) => ({
            valor: proyecto.id,
            etiqueta: `${proyecto.codigo} · ${proyecto.nombre}`,
          })),
        ]}
      />
      <label className="text-xs font-medium text-slate-600">
        Importe (€)
        <input name="importe" inputMode="decimal" required className="campo mt-1" placeholder="150.000,00" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Horas
        <input name="horas" type="number" min={0} step={1} className="campo mt-1" placeholder="Opcional" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Motivo
        <input name="motivo" className="campo mt-1" placeholder="Ampliación" maxLength={300} />
      </label>
      <div className="sm:col-span-5">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Guardando...' : 'Crear nueva versión'}
        </button>
      </div>
      <div className="sm:col-span-5">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}
