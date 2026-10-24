'use client'

import { useActionState } from 'react'
import { Select } from '@/components/Select'
import {
  actualizarConvenioAction,
  alternarConvenioAction,
  asignarConvenioAction,
  crearConvenioAction,
  eliminarReglaAction,
  guardarReglaAction,
  quitarAsignacionConvenioAction,
  type EstadoConvenio,
} from './actions'
import {
  APLICACIONES,
  ETIQUETAS_TIPO_HORA,
  TIPOS_HORA,
  formatearFactor,
  type TipoHora,
} from '@/modules/computo/domain/reglas'

const inicial: EstadoConvenio = {}

function Mensajes({ estado }: { estado: EstadoConvenio }) {
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

export function FormularioConvenio() {
  const [estado, accion, pendiente] = useActionState(crearConvenioAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <label className="text-xs font-medium text-slate-600">
        Código
        <input name="codigo" required className="campo mt-1" placeholder="CONV-01" />
        {estado.campo?.codigo ? <span className="text-red-600">{estado.campo.codigo}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">
        Nombre
        <input name="nombre" required className="campo mt-1" placeholder="Convenio de la construcción" />
        {estado.campo?.nombre ? <span className="text-red-600">{estado.campo.nombre}</span> : null}
      </label>
      <div className="self-end">
        <button type="submit" disabled={pendiente} className="boton-primario w-full">
          {pendiente ? 'Creando...' : 'Crear convenio'}
        </button>
      </div>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function FormularioEdicionConvenio({
  convenio,
}: {
  convenio: { id: string; codigo: string; nombre: string }
}) {
  const [estado, accion, pendiente] = useActionState(actualizarConvenioAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="convenioId" value={convenio.id} />
      <label className="text-xs font-medium text-slate-600">
        Código
        <input name="codigo" required defaultValue={convenio.codigo} className="campo mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">
        Nombre
        <input name="nombre" required defaultValue={convenio.nombre} className="campo mt-1" />
      </label>
      <div className="self-end">
        <button type="submit" disabled={pendiente} className="boton-secundario w-full">
          {pendiente ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function BotonAlternarConvenio({ convenioId, activo }: { convenioId: string; activo: boolean }) {
  const [estado, accion, pendiente] = useActionState(alternarConvenioAction, inicial)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="convenioId" value={convenioId} />
      <input type="hidden" name="activo" value={activo ? 'false' : 'true'} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        {activo ? 'Desactivar' : 'Activar'}
      </button>
      {estado.error ? <span className="ml-2 text-xs text-red-700">{estado.error}</span> : null}
    </form>
  )
}

export function FormularioRegla({
  convenioId,
  regla,
}: {
  convenioId: string
  regla?: {
    tipoHora: TipoHora
    factorBps: number
    aplicaEn: string
    topeDiarioMin: number | null
    topeSemanalMin: number | null
    requiereAutorizacion: boolean
    prioridad: number
  }
}) {
  const [estado, accion, pendiente] = useActionState(guardarReglaAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="convenioId" value={convenioId} />
      <Select
        etiqueta="Tipo de hora"
        name="tipoHora"
        valorInicial={regla?.tipoHora ?? 'NORMAL'}
        requerido
        opciones={TIPOS_HORA.map((tipo) => ({ valor: tipo, etiqueta: ETIQUETAS_TIPO_HORA[tipo] }))}
      />
      <Select
        etiqueta="Aplica en"
        name="aplicaEn"
        valorInicial={regla?.aplicaEn ?? 'TODO'}
        opciones={APLICACIONES.map((aplicacion) => ({
          valor: aplicacion,
          etiqueta:
            aplicacion === 'TODO'
              ? 'Cualquier día'
              : aplicacion === 'LABORABLE'
                ? 'Días laborables'
                : 'Festivos',
        }))}
      />
      <label className="text-xs font-medium text-slate-600">
        Factor
        <input
          name="factor"
          inputMode="decimal"
          required
          defaultValue={formatearFactor(regla?.factorBps ?? 10_000)}
          className="campo mt-1"
          placeholder="1,5"
        />
        {estado.campo?.factor || estado.campo?.factorBps ? (
          <span className="text-red-600">{estado.campo.factor ?? estado.campo.factorBps}</span>
        ) : null}
      </label>
      <label className="text-xs font-medium text-slate-600">
        Prioridad
        <input
          name="prioridad"
          type="number"
          min={0}
          max={10000}
          defaultValue={regla?.prioridad ?? 100}
          className="campo mt-1"
        />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Tope diario (horas)
        <input
          name="topeDiario"
          inputMode="decimal"
          defaultValue={regla?.topeDiarioMin ? String(regla.topeDiarioMin / 60).replace('.', ',') : ''}
          className="campo mt-1"
          placeholder="Sin tope"
        />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Tope semanal (horas)
        <input
          name="topeSemanal"
          inputMode="decimal"
          defaultValue={regla?.topeSemanalMin ? String(regla.topeSemanalMin / 60).replace('.', ',') : ''}
          className="campo mt-1"
          placeholder="Sin tope"
        />
      </label>
      <label className="flex items-center gap-2 self-end text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          name="requiereAutorizacion"
          defaultChecked={regla?.requiereAutorizacion ?? false}
          className="h-4 w-4"
        />
        Exige autorización previa
      </label>
      <div className="self-end">
        <button type="submit" disabled={pendiente} className="boton-secundario w-full">
          {pendiente ? 'Guardando...' : regla ? 'Actualizar regla' : 'Añadir regla'}
        </button>
      </div>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function BotonEliminarRegla({ convenioId, reglaId }: { convenioId: string; reglaId: string }) {
  const [estado, accion, pendiente] = useActionState(eliminarReglaAction, inicial)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="convenioId" value={convenioId} />
      <input type="hidden" name="reglaId" value={reglaId} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        Eliminar
      </button>
      {estado.error ? <span className="ml-2 text-xs text-red-700">{estado.error}</span> : null}
    </form>
  )
}

export function FormularioAsignacionConvenio({
  convenioId,
  empleados,
  hoy,
}: {
  convenioId: string
  empleados: { id: string; codigo: string; nombre: string }[]
  hoy: string
}) {
  const [estado, accion, pendiente] = useActionState(asignarConvenioAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="convenioId" value={convenioId} />
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
        Desde
        <input name="desde" type="date" defaultValue={hoy} required className="campo mt-1" />
      </label>
      <div className="self-end">
        <button type="submit" disabled={pendiente} className="boton-secundario w-full">
          {pendiente ? 'Asignando...' : 'Asignar'}
        </button>
      </div>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function BotonQuitarAsignacionConvenio({ asignacionId }: { asignacionId: string }) {
  const [estado, accion, pendiente] = useActionState(quitarAsignacionConvenioAction, inicial)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="asignacionId" value={asignacionId} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        Quitar
      </button>
      {estado.error ? <span className="ml-2 text-xs text-red-700">{estado.error}</span> : null}
    </form>
  )
}
