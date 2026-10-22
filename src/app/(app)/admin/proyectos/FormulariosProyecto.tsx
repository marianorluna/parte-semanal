'use client'

import { useActionState } from 'react'
import {
  alternarProyectoAction,
  crearAsignacionAction,
  crearProyectoAction,
  crearTareaAction,
  desactivarAsignacionAction,
  type EstadoProyecto,
} from './actions'

const inicial: EstadoProyecto = {}

function Mensajes({ estado }: { estado: EstadoProyecto }) {
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

export function FormularioProyecto() {
  const [estado, accion, pendiente] = useActionState(crearProyectoAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <label className="text-xs font-medium text-slate-600">
        Código
        <input name="codigo" required className="campo mt-1" placeholder="PRY-011" />
        {estado.campo?.codigo ? <span className="text-red-600">{estado.campo.codigo}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">
        Nombre
        <input name="nombre" required className="campo mt-1" />
        {estado.campo?.nombre ? <span className="text-red-600">{estado.campo.nombre}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600">
        Horas presupuesto
        <input name="horasPresupuesto" type="number" min={0} className="campo mt-1" placeholder="Opcional" />
      </label>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
      <div className="sm:col-span-4">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Creando...' : 'Crear proyecto'}
        </button>
      </div>
    </form>
  )
}

export function FormularioTarea({ proyectoId }: { proyectoId: string }) {
  const [estado, accion, pendiente] = useActionState(crearTareaAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <label className="text-xs font-medium text-slate-600">
        Código
        <input name="codigo" required className="campo mt-1" placeholder="T05" />
      </label>
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">
        Nombre
        <input name="nombre" required className="campo mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Horas presupuesto
        <input name="horasPresupuesto" type="number" min={0} className="campo mt-1" placeholder="Opcional" />
      </label>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
      <div className="sm:col-span-4">
        <button type="submit" disabled={pendiente} className="boton-secundario">
          {pendiente ? 'Creando...' : 'Añadir tarea'}
        </button>
      </div>
    </form>
  )
}

export function BotonAlternarProyecto({ proyectoId, activo }: { proyectoId: string; activo: boolean }) {
  const [estado, accion, pendiente] = useActionState(alternarProyectoAction, inicial)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <input type="hidden" name="activo" value={activo ? 'false' : 'true'} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        {activo ? 'Desactivar' : 'Activar'}
      </button>
      {estado.error ? <span className="ml-2 text-xs text-red-700">{estado.error}</span> : null}
    </form>
  )
}

export function FormularioAsignacion({
  proyectoId,
  empleados,
  tareas,
  hoy,
}: {
  proyectoId: string
  empleados: { id: string; codigo: string; nombre: string }[]
  tareas: { id: string; codigo: string; nombre: string }[]
  hoy: string
}) {
  const [estado, accion, pendiente] = useActionState(crearAsignacionAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-5">
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">
        Empleado
        <select name="empleadoId" required className="campo mt-1">
          <option value="">Selecciona</option>
          {empleados.map((empleado) => (
            <option key={empleado.id} value={empleado.id}>
              {empleado.codigo} · {empleado.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600">
        Tarea
        <select name="tareaId" required className="campo mt-1">
          <option value="">Selecciona</option>
          {tareas.map((tarea) => (
            <option key={tarea.id} value={tarea.id}>
              {tarea.codigo} · {tarea.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600">
        Desde
        <input name="desde" type="date" defaultValue={hoy} required className="campo mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Hasta
        <input name="hasta" type="date" className="campo mt-1" />
      </label>
      <div className="sm:col-span-5">
        <Mensajes estado={estado} />
      </div>
      <div className="sm:col-span-5">
        <button type="submit" disabled={pendiente} className="boton-secundario">
          {pendiente ? 'Asignando...' : 'Asignar tarea'}
        </button>
      </div>
    </form>
  )
}

export function BotonDesasignar({ asignacionId, proyectoId }: { asignacionId: string; proyectoId: string }) {
  const [estado, accion, pendiente] = useActionState(desactivarAsignacionAction, inicial)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="asignacionId" value={asignacionId} />
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        Finalizar
      </button>
      {estado.error ? <span className="ml-2 text-xs text-red-700">{estado.error}</span> : null}
    </form>
  )
}
