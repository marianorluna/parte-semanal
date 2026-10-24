import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { accionesDisponibles, listarAuditoria } from '@/modules/auditoria/infrastructure/consultas'
import { Select } from '@/components/Select'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ accion?: string; desde?: string; hasta?: string; pagina?: string }>
}

export default async function AdminAuditoriaPage({ searchParams }: Props) {
  await requireRol('ADMIN')
  const params = await searchParams

  const pagina = Math.max(1, Number(params.pagina ?? 1))
  const porPagina = 50

  const [{ filas, total }, acciones] = await Promise.all([
    listarAuditoria({
      accion: params.accion,
      desde: params.desde,
      hasta: params.hasta,
      pagina,
      porPagina,
    }),
    accionesDisponibles(),
  ])

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))

  const enlace = (paginaDestino: number) => {
    const base = new URLSearchParams()
    if (params.accion) base.set('accion', params.accion)
    if (params.desde) base.set('desde', params.desde)
    if (params.hasta) base.set('hasta', params.hasta)
    base.set('pagina', String(paginaDestino))
    return `/admin/auditoria?${base.toString()}`
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Auditoría</h1>
        <p className="text-sm text-slate-600">
          {total} eventos registrados. Solo lectura: los registros no se modifican ni se borran.
        </p>
      </div>

      <form
        className="tarjeta flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end"
        action="/admin/auditoria"
        method="get"
      >
        <Select
          etiqueta="Acción"
          name="accion"
          valorInicial={params.accion ?? ''}
          className="py-1.5 text-sm"
          opciones={[
            { valor: '', etiqueta: 'Todas' },
            ...acciones.map((accion) => ({ valor: accion, etiqueta: accion })),
          ]}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Desde
          <input type="date" name="desde" defaultValue={params.desde ?? ''} className="campo text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Hasta
          <input type="date" name="hasta" defaultValue={params.hasta ?? ''} className="campo text-sm" />
        </label>
        <button type="submit" className="boton-primario boton-campo text-xs">
          Filtrar
        </button>
        <Link href="/admin/auditoria" className="boton-secundario boton-campo text-xs">
          Limpiar
        </Link>
      </form>

      <div className="tarjeta hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Acción</th>
              <th className="px-3 py-2">Entidad</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatearInstante(fila.createdAt)}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{fila.accion}</td>
                <td className="px-3 py-2 text-slate-600">
                  {fila.entidad}
                  {fila.entidadId ? <span className="block text-[11px] text-slate-400">{fila.entidadId.slice(0, 8)}</span> : null}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fila.actorNombre ?? 'Sistema'}
                  {fila.actorEmail ? <span className="block text-[11px] text-slate-400">{fila.actorEmail}</span> : null}
                </td>
                <td className="max-w-72 px-3 py-2 text-[11px] text-slate-500">
                  {fila.motivo ? <span className="block text-slate-700">{fila.motivo}</span> : null}
                  {fila.despues ? <span className="block truncate">{JSON.stringify(fila.despues)}</span> : null}
                </td>
              </tr>
            ))}
            {filas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Sin eventos para estos filtros
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {filas.map((fila) => (
          <li key={fila.id} className="tarjeta p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-medium text-slate-800">{fila.accion}</span>
              <span className="text-[11px] text-slate-500">{formatearInstante(fila.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {fila.entidad}
              {fila.entidadId ? <span className="text-slate-400"> · {fila.entidadId.slice(0, 8)}</span> : null}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {fila.actorNombre ?? 'Sistema'}
              {fila.actorEmail ? <span className="block text-[11px] text-slate-400">{fila.actorEmail}</span> : null}
            </p>
            {fila.motivo || fila.despues ? (
              <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                {fila.motivo ? <p className="break-words text-slate-700">{fila.motivo}</p> : null}
                {fila.despues ? <p className="break-all">{JSON.stringify(fila.despues)}</p> : null}
              </div>
            ) : null}
          </li>
        ))}
        {filas.length === 0 ? (
          <li className="tarjeta p-8 text-center text-sm text-slate-500">Sin eventos para estos filtros</li>
        ) : null}
      </ul>

      {totalPaginas > 1 ? (
        <nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
            .filter((numero) => Math.abs(numero - pagina) <= 2 || numero === 1 || numero === totalPaginas)
            .map((numero) => (
              <Link
                key={numero}
                href={enlace(numero)}
                aria-current={numero === pagina ? 'page' : undefined}
                className={`rounded px-3 py-1 text-sm ${numero === pagina ? 'bg-marca-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`}
              >
                {numero}
              </Link>
            ))}
        </nav>
      ) : null}
    </section>
  )
}

function formatearInstante(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor)
}
