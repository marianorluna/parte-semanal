'use client'

import { useActionState } from 'react'
import { Select } from '@/components/Select'
import { COMUNIDADES } from '@/modules/calendario/domain/festivos-espana'
import {
  actualizarCalendarioAction,
  alternarCalendarioAction,
  alternarFestivoAction,
  asignarEmpleadoAction,
  crearCalendarioAction,
  crearExcepcionAction,
  crearFestivoAction,
  crearJornadaAction,
  eliminarExcepcionAction,
  eliminarFestivoAction,
  eliminarJornadaAction,
  generarFestivosAction,
  importarFestivosAction,
  quitarAsignacionAction,
  type EstadoCalendario,
} from './actions'
import type { CalendarioCompleto } from '@/modules/calendario/application/ports'

const inicial: EstadoCalendario = {}
const ANIO_ACTUAL = new Date().getFullYear()
const HOY = new Date().toISOString().slice(0, 10)

const DIAS = [
  { valor: '1', etiqueta: 'L' },
  { valor: '2', etiqueta: 'M' },
  { valor: '3', etiqueta: 'X' },
  { valor: '4', etiqueta: 'J' },
  { valor: '5', etiqueta: 'V' },
  { valor: '6', etiqueta: 'S' },
  { valor: '7', etiqueta: 'D' },
] as const

const AMBITOS = [
  { valor: 'EMPRESA', etiqueta: 'Empresa' },
  { valor: 'LOCAL', etiqueta: 'Local (municipio)' },
  { valor: 'PROVINCIA', etiqueta: 'Provincia' },
  { valor: 'CCAA', etiqueta: 'Comunidad autónoma' },
  { valor: 'NACIONAL', etiqueta: 'Nacional' },
] as const

function Mensajes({ estado }: { estado: EstadoCalendario }) {
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
      {estado.informe && estado.informe.rechazos.length > 0 ? (
        <ul className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {estado.informe.rechazos.map((rechazo) => (
            <li key={`${rechazo.linea}-${rechazo.motivo}`}>
              Línea {rechazo.linea}: {rechazo.motivo}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

export function FormularioCalendario({ calendario }: { calendario?: CalendarioCompleto }) {
  const accion = calendario ? actualizarCalendarioAction : crearCalendarioAction
  const [estado, enviar, pendiente] = useActionState(accion, inicial)
  const dias = new Set(calendario?.diasSemana ?? [1, 2, 3, 4, 5])

  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {calendario ? <input type="hidden" name="calendarioId" value={calendario.id} /> : null}

      <label className="text-xs font-medium text-slate-600 lg:col-span-2">
        Nombre
        <input
          name="nombre"
          required
          defaultValue={calendario?.nombre ?? 'Calendario de empresa'}
          className="campo mt-1"
        />
        {estado.campo?.nombre ? <span className="text-red-600">{estado.campo.nombre}</span> : null}
      </label>

      {calendario ? null : (
        <label className="text-xs font-medium text-slate-600">
          Código
          <input name="codigo" required defaultValue="EMPRESA" className="campo mt-1" />
          {estado.campo?.codigo ? <span className="text-red-600">{estado.campo.codigo}</span> : null}
        </label>
      )}

      <div className="text-xs font-medium text-slate-600">
        <Select
          etiqueta="Ámbito"
          name="ambito"
          valorInicial={calendario?.ambito ?? 'EMPRESA'}
          opciones={AMBITOS.map((ambito) => ({ valor: ambito.valor, etiqueta: ambito.etiqueta }))}
          className="text-sm"
        />
      </div>

      <div className="text-xs font-medium text-slate-600">
        <Select
          etiqueta="Comunidad"
          name="comunidad"
          valorInicial={calendario?.comunidad ?? ''}
          opciones={[
            { valor: '', etiqueta: 'Sin comunidad' },
            ...COMUNIDADES.map((comunidad) => ({
              valor: comunidad.codigo,
              etiqueta: `${comunidad.codigo} · ${comunidad.nombre}`,
            })),
          ]}
          className="text-sm"
        />
      </div>

      <fieldset className="text-xs font-medium text-slate-600 lg:col-span-2">
        <legend>Días laborables</legend>
        <div className="mt-1 flex gap-1">
          {DIAS.map((dia) => (
            <label
              key={dia.valor}
              className="flex min-h-9 w-9 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 has-checked:border-marca-600 has-checked:bg-marca-600 has-checked:text-white"
            >
              <input
                type="checkbox"
                name="diasSemana"
                value={dia.valor}
                defaultChecked={dias.has(Number(dia.valor))}
                className="sr-only"
              />
              {dia.etiqueta}
            </label>
          ))}
        </div>
        {estado.campo?.diasSemana ? <span className="text-red-600">{estado.campo.diasSemana}</span> : null}
      </fieldset>

      <label className="text-xs font-medium text-slate-600">
        Jornada diaria (horas)
        <input
          name="horasDiarias"
          type="text"
          inputMode="decimal"
          defaultValue={
            calendario?.horasDiariasMin ? (calendario.horasDiariasMin / 60).toString().replace('.', ',') : ''
          }
          placeholder="8"
          className="campo mt-1"
        />
        {estado.campo?.horasDiariasMin ? (
          <span className="text-red-600">{estado.campo.horasDiariasMin}</span>
        ) : null}
      </label>

      <label className="text-xs font-medium text-slate-600">
        Vigente desde
        <input
          name="vigenteDesde"
          type="date"
          required
          defaultValue={calendario?.vigenteDesde ?? `${ANIO_ACTUAL}-01-01`}
          className="campo mt-1"
        />
        {estado.campo?.vigenteDesde ? <span className="text-red-600">{estado.campo.vigenteDesde}</span> : null}
      </label>

      <label className="text-xs font-medium text-slate-600">
        Vigente hasta
        <input
          name="vigenteHasta"
          type="date"
          defaultValue={calendario?.vigenteHasta ?? ''}
          className="campo mt-1"
        />
        {estado.campo?.vigenteHasta ? <span className="text-red-600">{estado.campo.vigenteHasta}</span> : null}
      </label>

      <label className="flex items-center gap-2 text-xs font-medium text-slate-600 lg:col-span-2">
        <input
          type="checkbox"
          name="esPredeterminado"
          defaultChecked={calendario?.esPredeterminado ?? true}
          className="h-4 w-4"
        />
        Aplicar a quien no tenga un calendario asignado
      </label>

      <p className="text-xs text-slate-500 lg:col-span-4">
        El calendario define los días laborables. Los festivos se añaden debajo: la precarga de referencia es
        orientativa y cada año conviene revisar los traslados oficiales.
      </p>

      <div className="lg:col-span-4">
        <Mensajes estado={estado} />
      </div>

      <div className="lg:col-span-4">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Guardando...' : calendario ? 'Guardar cambios' : 'Crear calendario'}
        </button>
      </div>
    </form>
  )
}

export function FormularioFestivo({ calendarioId, anio }: { calendarioId: string; anio: number }) {
  const [estado, enviar, pendiente] = useActionState(crearFestivoAction, inicial)

  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="calendarioId" value={calendarioId} />
      <label className="text-xs font-medium text-slate-600">
        Fecha
        <input name="fecha" type="date" required defaultValue={`${anio}-01-01`} className="campo mt-1" />
        {estado.campo?.fecha ? <span className="text-red-600">{estado.campo.fecha}</span> : null}
      </label>
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">
        Nombre
        <input name="nombre" required placeholder="Festivo local" className="campo mt-1" />
        {estado.campo?.nombre ? <span className="text-red-600">{estado.campo.nombre}</span> : null}
      </label>
      <div className="text-xs font-medium text-slate-600">
        <Select
          etiqueta="Ámbito"
          name="ambito"
          valorInicial="LOCAL"
          opciones={AMBITOS.map((ambito) => ({ valor: ambito.valor, etiqueta: ambito.etiqueta }))}
          className="text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-4">
        <input type="checkbox" name="esLaborable" className="h-4 w-4" />
        Marcar como laborable (abre el día en lugar de cerrarlo)
      </label>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
      <div className="sm:col-span-4">
        <button type="submit" disabled={pendiente} className="boton-secundario">
          {pendiente ? 'Añadiendo...' : 'Añadir festivo'}
        </button>
      </div>
    </form>
  )
}

export function FormularioGenerarFestivos({
  calendarioId,
  anio,
}: {
  calendarioId: string
  anio: number
}) {
  const [estado, enviar, pendiente] = useActionState(generarFestivosAction, inicial)

  return (
    <form action={enviar} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="calendarioId" value={calendarioId} />
      <label className="text-xs font-medium text-slate-600">
        Año
        <input
          name="anio"
          type="number"
          min={2000}
          max={2100}
          defaultValue={anio}
          className="campo mt-1 w-28"
        />
      </label>
      <button type="submit" disabled={pendiente} className="boton-secundario">
        {pendiente ? 'Generando...' : 'Precargar festivos del año'}
      </button>
      <div className="w-full">
        <Mensajes estado={estado} />
      </div>
    </form>
  )
}

export function FormularioImportarFestivos({ calendarioId }: { calendarioId: string }) {
  const [estado, enviar, pendiente] = useActionState(importarFestivosAction, inicial)

  return (
    <form action={enviar} className="grid gap-3">
      <input type="hidden" name="calendarioId" value={calendarioId} />
      <label className="text-xs font-medium text-slate-600">
        CSV: una línea por festivo con <code>fecha;nombre</code>
        <textarea
          name="csv"
          rows={4}
          placeholder={'2027-01-01;Año Nuevo\n06/01/2027;Epifanía'}
          className="campo mt-1 font-mono text-xs"
        />
      </label>
      <p className="text-xs text-slate-500">
        Acepta <code>AAAA-MM-DD</code> y <code>DD/MM/AAAA</code>. Un tercer campo con «si» abre el día. Las
        fechas que ya existan se ignoran.
      </p>
      <Mensajes estado={estado} />
      <div>
        <button type="submit" disabled={pendiente} className="boton-secundario">
          {pendiente ? 'Importando...' : 'Importar CSV'}
        </button>
      </div>
    </form>
  )
}

export function FormularioExcepcion({ calendarioId }: { calendarioId: string }) {
  const [estado, enviar, pendiente] = useActionState(crearExcepcionAction, inicial)

  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="calendarioId" value={calendarioId} />
      <label className="text-xs font-medium text-slate-600">
        Fecha
        <input name="fecha" type="date" required defaultValue={HOY} className="campo mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">
        Motivo
        <input name="motivo" required placeholder="Puente, inventario, jornada intensiva..." className="campo mt-1" />
        {estado.campo?.motivo ? <span className="text-red-600">{estado.campo.motivo}</span> : null}
      </label>
      <div className="text-xs font-medium text-slate-600">
        <Select
          etiqueta="Efecto"
          name="laborable"
          valorInicial="false"
          opciones={[
            { valor: 'false', etiqueta: 'Cerrar el día' },
            { valor: 'true', etiqueta: 'Abrir el día' },
          ]}
          className="text-sm"
        />
      </div>
      <div className="sm:col-span-4">
        <Mensajes estado={estado} />
      </div>
      <div className="sm:col-span-4">
        <button type="submit" disabled={pendiente} className="boton-secundario">
          {pendiente ? 'Guardando...' : 'Guardar excepción'}
        </button>
      </div>
    </form>
  )
}

export function FormularioJornada({
  calendarioId,
  empleados,
}: {
  calendarioId: string
  empleados: { id: string; nombre: string; codigo: string }[]
}) {
  const [estado, enviar, pendiente] = useActionState(crearJornadaAction, inicial)

  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-5">
      <input type="hidden" name="calendarioId" value={calendarioId} />
      <div className="text-xs font-medium text-slate-600 sm:col-span-2">
        <Select
          etiqueta="Empleado"
          name="empleadoId"
          valorInicial=""
          opciones={[
            { valor: '', etiqueta: 'Toda la empresa' },
            ...empleados.map((empleado) => ({
              valor: empleado.id,
              etiqueta: `${empleado.codigo} · ${empleado.nombre}`,
            })),
          ]}
          className="text-sm"
        />
      </div>
      <label className="text-xs font-medium text-slate-600">
        Desde
        <input name="desde" type="date" required defaultValue={`${ANIO_ACTUAL}-01-01`} className="campo mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Hasta
        <input name="hasta" type="date" className="campo mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Horas/semana
        <input name="horasSemanales" type="text" inputMode="decimal" required placeholder="40" className="campo mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Horas/día
        <input name="horasDiarias" type="text" inputMode="decimal" placeholder="8" className="campo mt-1" />
      </label>
      <div className="sm:col-span-5">
        <Mensajes estado={estado} />
      </div>
      <div className="sm:col-span-5">
        <button type="submit" disabled={pendiente} className="boton-secundario">
          {pendiente ? 'Guardando...' : 'Añadir jornada teórica'}
        </button>
      </div>
    </form>
  )
}

export function FormularioAsignacion({
  calendarioId,
  empleados,
}: {
  calendarioId: string
  empleados: { id: string; nombre: string; codigo: string }[]
}) {
  const [estado, enviar, pendiente] = useActionState(asignarEmpleadoAction, inicial)

  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="calendarioId" value={calendarioId} />
      <div className="text-xs font-medium text-slate-600 sm:col-span-2">
        <Select
          etiqueta="Empleado"
          name="empleadoId"
          requerido
          opciones={empleados.map((empleado) => ({
            valor: empleado.id,
            etiqueta: `${empleado.codigo} · ${empleado.nombre}`,
          }))}
          className="text-sm"
        />
      </div>
      <label className="text-xs font-medium text-slate-600">
        Desde
        <input name="desde" type="date" required defaultValue={HOY} className="campo mt-1" />
      </label>
      <div className="flex items-end">
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

/**
 * Botón con acción de servidor y campos ocultos. Se usa para alternar estados y
 * eliminar, siempre con confirmación cuando la acción destruye información.
 */
export function BotonAccion({
  accion,
  campos,
  etiqueta,
  variante = 'secundario',
  confirmar,
}: {
  accion: (estado: EstadoCalendario, formData: FormData) => Promise<EstadoCalendario>
  campos: Record<string, string>
  etiqueta: string
  variante?: 'secundario' | 'peligro'
  confirmar?: string
}) {
  const [estado, enviar, pendiente] = useActionState(accion, inicial)

  return (
    <form
      action={enviar}
      onSubmit={(evento) => {
        if (confirmar && !window.confirm(confirmar)) evento.preventDefault()
      }}
      className="inline"
    >
      {Object.entries(campos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      <button
        type="submit"
        disabled={pendiente}
        className={
          variante === 'peligro'
            ? 'min-h-9 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50'
            : 'min-h-9 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50'
        }
      >
        {etiqueta}
      </button>
      {estado.error ? (
        <span role="alert" className="ml-2 text-xs text-red-700">
          {estado.error}
        </span>
      ) : null}
      {estado.ok ? (
        <span role="status" className="ml-2 text-xs text-acento-800">
          {estado.ok}
        </span>
      ) : null}
    </form>
  )
}

export { alternarCalendarioAction, alternarFestivoAction, eliminarExcepcionAction, eliminarFestivoAction, eliminarJornadaAction, quitarAsignacionAction }
