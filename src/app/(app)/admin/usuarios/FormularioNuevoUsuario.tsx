'use client'

import { useActionState } from 'react'
import { crearUsuarioAction, type EstadoAdmin } from './actions'

const inicial: EstadoAdmin = {}

type Opcion = { id: string; codigo: string; nombre: string }

export function FormularioNuevoUsuario({
  proyectos,
  empleados,
}: {
  proyectos: Opcion[]
  empleados: Opcion[]
}) {
  const [estado, accion, pendiente] = useActionState(crearUsuarioAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-slate-600">
        Email
        <input name="email" type="email" required className="campo mt-1" />
        {estado.campo?.email ? <span className="text-red-600">{estado.campo.email}</span> : null}
      </label>

      <label className="text-xs font-medium text-slate-600">
        Nombre y apellidos
        <input name="nombre" type="text" required className="campo mt-1" />
        {estado.campo?.nombre ? <span className="text-red-600">{estado.campo.nombre}</span> : null}
      </label>

      <label className="text-xs font-medium text-slate-600">
        Rol
        <select name="rol" defaultValue="TRABAJADOR" className="campo mt-1">
          <option value="TRABAJADOR">Trabajador</option>
          <option value="ENCARGADO">Encargado</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </label>

      <label className="text-xs font-medium text-slate-600">
        Contraseña inicial
        <input name="password" type="text" required minLength={8} className="campo mt-1" placeholder="Mínimo 8 caracteres" />
        {estado.campo?.password ? <span className="text-red-600">{estado.campo.password}</span> : null}
      </label>

      <label className="text-xs font-medium text-slate-600">
        Empleado existente (opcional)
        <select name="empleadoId" defaultValue="" className="campo mt-1">
          <option value="">Sin empleado / crear uno nuevo</option>
          {empleados.map((empleado) => (
            <option key={empleado.id} value={empleado.id}>
              {empleado.codigo} · {empleado.nombre}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-600">
          Código empleado
          <input name="empleadoCodigo" type="text" className="campo mt-1" placeholder="Auto" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Nombre empleado
          <input name="empleadoNombre" type="text" className="campo mt-1" placeholder="Si es nuevo" />
        </label>
      </div>

      <fieldset className="sm:col-span-2">
        <legend className="mb-1 text-xs font-medium text-slate-600">Proyectos asignados (encargados)</legend>
        <div className="grid max-h-40 gap-1 overflow-y-auto rounded border border-slate-200 p-2 sm:grid-cols-2">
          {proyectos.map((proyecto) => (
            <label key={proyecto.id} className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" name="proyectos" value={proyecto.id} />
              <span className="truncate">
                {proyecto.codigo} · {proyecto.nombre}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {estado.error ? (
        <p role="alert" className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="sm:col-span-2 rounded-md bg-acento-50 px-3 py-2 text-sm text-acento-800">
          {estado.ok}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>
    </form>
  )
}
