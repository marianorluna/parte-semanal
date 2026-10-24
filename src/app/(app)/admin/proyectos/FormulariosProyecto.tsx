'use client'

import { useActionState } from 'react'
import {
  actualizarProyectoAction,
  alternarProyectoAction,
  crearAsignacionAction,
  crearProyectoAction,
  crearTareaAction,
  desactivarAsignacionAction,
  type EstadoProyecto,
} from './actions'
import { Select } from '@/components/Select'

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
      <label className="text-xs font-medium text-slate-600">
        Inicio
        <input name="fechaInicio" type="date" className="campo mt-1" />
        {estado.campo?.fechaInicio ? <span className="text-red-600">{estado.campo.fechaInicio}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600">
        Fin
        <input name="fechaFin" type="date" className="campo mt-1" />
        {estado.campo?.fechaFin ? <span className="text-red-600">{estado.campo.fechaFin}</span> : null}
      </label>
      <p className="self-end text-xs text-slate-500 sm:col-span-2">
        Las fechas permiten avisar de desviación entre horas consumidas y plazo transcurrido.
      </p>
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

export function FormularioEdicionProyecto({
  proyecto,
}: {
  proyecto: {
    id: string
    codigo: string
    nombre: string
    horasPresupuesto: number | null
    fechaInicio: string | null
    fechaFin: string | null
  }
}) {
  const [estado, accion, pendiente] = useActionState(actualizarProyectoAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="proyectoId" value={proyecto.id} />
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">
        Nombre
        <input name="nombre" required defaultValue={proyecto.nombre} className="campo mt-1" />
        {estado.campo?.nombre ? <span className="text-red-600">{estado.campo.nombre}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600">
        Horas presupuesto
        <input
          name="horasPresupuesto"
          type="number"
          min={0}
          defaultValue={proyecto.horasPresupuesto ?? ''}
          className="campo mt-1"
          placeholder="Opcional"
        />
      </label>
      <p className="self-end text-xs text-slate-500">Código {proyecto.codigo}</p>
      <label className="text-xs font-medium text-slate-600">
        Inicio
        <input name="fechaInicio" type="date" defaultValue={proyecto.fechaInicio ?? ''} className="campo mt-1" />
        {estado.campo?.fechaInicio ? <span className="text-red-600">{estado.campo.fechaInicio}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600">
        Fin
        <input name="fechaFin" type="date" defaultValue={proyecto.fechaFin ?? ''} className="campo mt-1" />
        {estado.campo?.fechaFin ? <span className="text-red-600">{estado.campo.fechaFin}</span> : null}
      </label>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
      <div className="sm:col-span-4">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Guardando...' : 'Guardar cambios'}
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
      <Select
        etiqueta="Tarea"
        name="tareaId"
        requerido
        opciones={[
          { valor: '', etiqueta: 'Selecciona' },
          ...tareas.map((tarea) => ({
            valor: tarea.id,
            etiqueta: `${tarea.codigo} · ${tarea.nombre}`,
          })),
        ]}
      />
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
