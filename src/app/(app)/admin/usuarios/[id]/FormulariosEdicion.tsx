'use client'

import { useActionState } from 'react'
import {
  actualizarUsuarioAction,
  resetPasswordAction,
  type EstadoAdmin,
} from '../actions'

const inicial: EstadoAdmin = {}

type Opcion = { id: string; codigo: string; nombre: string }

export function FormularioEditarUsuario({
  usuarioId,
  nombre,
  rol,
  activo,
  proyectos,
  asignados,
}: {
  usuarioId: string
  nombre: string
  rol: string
  activo: boolean
  proyectos: Opcion[]
  asignados: string[]
}) {
  const [estado, accion, pendiente] = useActionState(actualizarUsuarioAction, inicial)

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />

      <label className="block text-xs font-medium text-slate-600">
        Nombre
        <input name="nombre" defaultValue={nombre} required className="campo mt-1" />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          Rol
          <select name="rol" defaultValue={rol} className="campo mt-1">
            <option value="TRABAJADOR">Trabajador</option>
            <option value="ENCARGADO">Encargado</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>

        <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="activo" defaultChecked={activo} />
          Usuario activo
        </label>
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-slate-600">Proyectos asignados</legend>
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded border border-slate-200 p-2 sm:grid-cols-2">
          {proyectos.map((proyecto) => (
            <label key={proyecto.id} className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                name="proyectos"
                value={proyecto.id}
                defaultChecked={asignados.includes(proyecto.id)}
              />
              <span className="truncate">
                {proyecto.codigo} · {proyecto.nombre}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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

      <button type="submit" disabled={pendiente} className="boton-primario">
        {pendiente ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}

export function FormularioPassword({ usuarioId }: { usuarioId: string }) {
  const [estado, accion, pendiente] = useActionState(resetPasswordAction, inicial)

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />

      <label className="block text-xs font-medium text-slate-600">
        Nueva contraseña
        <input name="password" type="text" minLength={8} required className="campo mt-1" placeholder="Mínimo 8 caracteres" />
      </label>

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

      <button type="submit" disabled={pendiente} className="boton-secundario">
        {pendiente ? 'Actualizando...' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
