'use client'

import { useActionState } from 'react'
import { cargarDemoAction, purgarDemoAction, type EstadoDemo } from './actions'

const inicial: EstadoDemo = {}

function Mensajes({ estado }: { estado: EstadoDemo }) {
  return (
    <>
      {estado.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <div role="status" className="rounded-md bg-acento-50 px-3 py-2 text-sm text-acento-800">
          <p className="font-medium">{estado.ok}</p>
          {estado.detalle ? <p className="text-xs">{estado.detalle}</p> : null}
        </div>
      ) : null}
    </>
  )
}

export function AccionesDemo({ existeDemo }: { existeDemo: boolean }) {
  const [estadoCarga, accionCarga, cargando] = useActionState(cargarDemoAction, inicial)
  const [estadoPurga, accionPurga, purgando] = useActionState(purgarDemoAction, inicial)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="tarjeta p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {existeDemo ? 'Recargar datos de demostración' : 'Cargar datos de demostración'}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Crea 50 empleados, 11 proyectos, 14 semanas de partes y todos los datos de fase 2: calendario,
          convenios, ausencias, costes, presupuestos, cierres, informes, avisos, correo, API y webhooks.
          Si ya existe la empresa DEMO, se purga antes de volver a cargarla.
        </p>

        <form action={accionCarga} className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-slate-600">
            Escribe CARGAR para confirmar
            <input name="confirmacion" className="campo mt-1" placeholder="CARGAR" autoComplete="off" />
          </label>
          <Mensajes estado={estadoCarga} />
          <button type="submit" disabled={cargando} className="boton-primario">
            {cargando ? 'Cargando...' : existeDemo ? 'Purgar y recargar' : 'Cargar demo'}
          </button>
        </form>
      </div>

      <div className="tarjeta border-red-200 p-4">
        <h2 className="text-sm font-semibold text-red-800">Purgar datos de demostración</h2>
        <p className="mt-1 text-xs text-slate-600">
          Borra solo la empresa DEMO: personas, proyectos, partes, datos de fase 2 y la auditoría asociada.
          No toca datos reales.
        </p>

        <form action={accionPurga} className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-slate-600">
            Escribe PURGAR para confirmar
            <input name="confirmacion" className="campo mt-1" placeholder="PURGAR" autoComplete="off" />
          </label>
          <Mensajes estado={estadoPurga} />
          <button type="submit" disabled={purgando || !existeDemo} className="boton-peligro">
            {purgando ? 'Purgando...' : 'Purgar demo'}
          </button>
        </form>
      </div>
    </div>
  )
}
