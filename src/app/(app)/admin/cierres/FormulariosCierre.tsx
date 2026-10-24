'use client'

import { useActionState } from 'react'
import { Select } from '@/components/Select'
import {
  cerrarMesAction,
  cerrarSemanaAction,
  reabrirPeriodoAction,
  type EstadoCierre,
} from './actions'

const inicial: EstadoCierre = {}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

type EmpleadoOpcion = { id: string; codigo: string; nombre: string }

function Mensajes({ estado }: { estado: EstadoCierre }) {
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

function CampoMotivo({ etiqueta, requerido }: { etiqueta: string; requerido: boolean }) {
  return (
    <label className="text-xs font-medium text-slate-600 sm:col-span-2">
      {etiqueta}
      <input
        name="motivo"
        maxLength={300}
        required={requerido}
        className="campo mt-1"
        placeholder="Cierre de nómina de octubre"
      />
    </label>
  )
}

export function FormularioCierreSemanal({
  empleados,
  anio,
  semana,
}: {
  empleados: EmpleadoOpcion[]
  anio: number
  semana: number
}) {
  const [estado, accion, pendiente] = useActionState(cerrarSemanaAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-medium text-slate-600">
        Año ISO
        <input
          name="anio"
          type="number"
          min={2000}
          max={2100}
          defaultValue={anio}
          required
          className="campo mt-1"
        />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Semana ISO
        <input
          name="semana"
          type="number"
          min={1}
          max={53}
          defaultValue={semana}
          required
          className="campo mt-1"
        />
      </label>
      <Select
        etiqueta="Ámbito"
        name="empleadoId"
        valorInicial=""
        opciones={[
          { valor: '', etiqueta: 'Toda la empresa' },
          ...empleados.map((empleado) => ({
            valor: empleado.id,
            etiqueta: `${empleado.codigo} · ${empleado.nombre}`,
          })),
        ]}
      />
      <CampoMotivo etiqueta="Motivo del cierre (opcional)" requerido={false} />
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Cerrando...' : 'Cerrar semana'}
        </button>
        <span className="text-xs text-slate-500">
          Los partes aprobados pasan a Bloqueado. Un cierre repetido se rechaza.
        </span>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function FormularioCierreMensual({
  empleados,
  anio,
  mes,
}: {
  empleados: EmpleadoOpcion[]
  anio: number
  mes: number
}) {
  const [estado, accion, pendiente] = useActionState(cerrarMesAction, inicial)

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Select
        etiqueta="Empleado"
        name="empleadoId"
        valorInicial=""
        requerido
        opciones={[
          { valor: '', etiqueta: 'Selecciona un empleado' },
          ...empleados.map((empleado) => ({
            valor: empleado.id,
            etiqueta: `${empleado.codigo} · ${empleado.nombre}`,
          })),
        ]}
      />
      <label className="text-xs font-medium text-slate-600">
        Año
        <input
          name="anio"
          type="number"
          min={2000}
          max={2100}
          defaultValue={anio}
          required
          className="campo mt-1"
        />
      </label>
      <Select
        etiqueta="Mes"
        name="mes"
        valorInicial={String(mes)}
        opciones={MESES.map((nombre, indice) => ({
          valor: String(indice + 1),
          etiqueta: `${String(indice + 1).padStart(2, '0')} · ${nombre}`,
        }))}
      />
      <CampoMotivo etiqueta="Motivo del cierre (opcional)" requerido={false} />
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Cerrando...' : 'Cerrar mes'}
        </button>
        <span className="text-xs text-slate-500">
          Bloquea los partes con horas imputadas en ese mes natural, aunque la semana cruce de mes.
        </span>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function BotonReabrirPeriodo({ periodoId, etiqueta }: { periodoId: string; etiqueta: string }) {
  const [estado, accion, pendiente] = useActionState(reabrirPeriodoAction, inicial)

  return (
    <details>
      <summary className="cursor-pointer text-xs font-semibold text-marca-800">
        Reabrir {etiqueta}
      </summary>
      <form action={accion} className="mt-2 space-y-2">
        <input type="hidden" name="periodoId" value={periodoId} />
        <label className="block text-xs font-medium text-slate-600">
          Motivo de la reapertura
          <textarea
            name="motivo"
            required
            minLength={5}
            maxLength={300}
            rows={2}
            className="campo mt-1"
            placeholder="Corrección solicitada por el trabajador"
          />
        </label>
        <button type="submit" disabled={pendiente} className="boton-secundario">
          {pendiente ? 'Reabriendo...' : 'Confirmar reapertura'}
        </button>
        <Mensajes estado={estado} />
      </form>
    </details>
  )
}
