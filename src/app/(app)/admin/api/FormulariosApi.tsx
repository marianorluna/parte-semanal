'use client'

import { useActionState } from 'react'
import { ALCANCES, EVENTOS, type Alcance, type Evento } from '@/modules/integraciones/domain/api'
import {
  cambiarWebhookAction,
  crearClaveAction,
  crearWebhookAction,
  revocarClaveAction,
  type EstadoApi,
} from './actions'

const inicial: EstadoApi = {}

const ETIQUETA_ALCANCE: Record<Alcance, string> = {
  'partes:leer': 'Leer partes',
  'proyectos:leer': 'Leer proyectos',
  'imputaciones:escribir': 'Escribir imputaciones',
}

const ETIQUETA_EVENTO: Record<Evento, string> = {
  'parte.enviado': 'Parte enviado',
  'parte.aprobado': 'Parte aprobado',
  'parte.rechazado': 'Parte rechazado',
  'parte.reabierto': 'Parte reabierto',
}

function Mensajes({ estado }: { estado: EstadoApi }) {
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
      {estado.clave ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">Clave de API (solo se muestra ahora)</p>
          <code className="mt-1 block break-all font-mono text-xs text-amber-900">{estado.clave}</code>
        </div>
      ) : null}
      {estado.secreto ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">Secreto de firma (solo se muestra ahora)</p>
          <code className="mt-1 block break-all font-mono text-xs text-amber-900">
            {estado.secreto}
          </code>
        </div>
      ) : null}
    </>
  )
}

export function FormularioClave() {
  const [estado, accion, pendiente] = useActionState(crearClaveAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-slate-600">
        Nombre
        <input name="nombre" required maxLength={80} className="campo mt-1" placeholder="ERP nómina" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Caduca el (opcional)
        <input name="caduca" type="date" className="campo mt-1" />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-xs font-medium text-slate-600">Alcances</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {ALCANCES.map((alcance) => (
            <label key={alcance} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                name="alcances"
                value={alcance}
                defaultChecked={alcance !== 'imputaciones:escribir'}
                className="h-4 w-4 accent-marca-700"
              />
              {ETIQUETA_ALCANCE[alcance]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Creando...' : 'Crear clave'}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function FormularioWebhook() {
  const [estado, accion, pendiente] = useActionState(crearWebhookAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-slate-600">
        Nombre
        <input name="nombre" required maxLength={80} className="campo mt-1" placeholder="ERP de nómina" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        URL https
        <input
          name="url"
          type="url"
          required
          className="campo mt-1"
          placeholder="https://ejemplo.com/webhooks/partes"
        />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-xs font-medium text-slate-600">Eventos</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {EVENTOS.map((evento) => (
            <label key={evento} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                name="eventos"
                value={evento}
                defaultChecked
                className="h-4 w-4 accent-marca-700"
              />
              {ETIQUETA_EVENTO[evento]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Creando...' : 'Crear webhook'}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function BotonRevocarClave({ id }: { id: string }) {
  const [estado, accion, pendiente] = useActionState(revocarClaveAction, inicial)

  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        {pendiente ? 'Revocando...' : 'Revocar'}
      </button>
      {estado.error ? (
        <p role="alert" className="mt-1 text-[11px] text-red-700">
          {estado.error}
        </p>
      ) : null}
    </form>
  )
}

export function BotonEstadoWebhook({ id, activo }: { id: string; activo: boolean }) {
  const [estado, accion, pendiente] = useActionState(cambiarWebhookAction, inicial)

  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={activo ? 'false' : 'true'} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        {pendiente ? 'Guardando...' : activo ? 'Desactivar' : 'Activar'}
      </button>
      {estado.error ? (
        <p role="alert" className="mt-1 text-[11px] text-red-700">
          {estado.error}
        </p>
      ) : null}
    </form>
  )
}
