import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarProyectos, proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsPartes } from '@/composition'
import { hoyEnZona, semanaIsoDe, semanaIso } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { ESTADOS } from '@/modules/partes/domain/parte'
import { bandejaSoloTrabajadores } from '@/modules/partes/domain/permisos'
import { TablaPartes } from './TablaPartes'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ y?: string; w?: string; estado?: string; proyecto?: string; pagina?: string }>
}

export default async function ControlPartesPage({ searchParams }: Props) {
  const usuario = await requireRol('ENCARGADO', 'ADMIN')
  const params = await searchParams

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaHoy = semanaIsoDe(hoy)

  const anio = Number(params.y ?? semanaHoy.isoYear)
  const numeroSemana = Number(params.w ?? semanaHoy.isoWeek)
  const pagina = Math.max(1, Number(params.pagina ?? 1))
  const porPagina = 25

  const estado = ESTADOS.find((e) => e === params.estado)
  const permitidos = await proyectosPermitidos(usuario)

  const semana = (() => {
    try {
      return semanaIso(anio, numeroSemana)
    } catch {
      return semanaHoy
    }
  })()

  const resultado = await depsPartes.repo.listarParaControl({
    empresaId: usuario.empresaId,
    isoYear: semana.isoYear,
    isoWeek: semana.isoWeek,
    estado,
    proyectoId: params.proyecto,
    proyectosPermitidos: permitidos,
    soloTrabajadores: bandejaSoloTrabajadores(usuario.rol),
    pagina,
    porPagina,
  })

  const proyectos = await listarProyectos(usuario.empresaId)
  const totalPaginas = Math.max(1, Math.ceil(resultado.total / porPagina))

  const query = (cambios: Record<string, string | undefined>) => {
    const base = new URLSearchParams()
    const valores = {
      y: String(semana.isoYear),
      w: String(semana.isoWeek),
      estado: estado ?? '',
      proyecto: params.proyecto ?? '',
      pagina: '1',
      ...cambios,
    }
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor) base.set(clave, valor)
    }
    return `/control/partes?${base.toString()}`
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Partes de la semana</h1>
          <p className="text-sm text-slate-600">
            Semana {semana.isoWeek} de {semana.isoYear} · {resultado.total} partes ·{' '}
            {formatearHorasReloj(resultado.totalMinutos)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={query({ w: String(semana.isoWeek - 1), y: String(semana.isoYear) })} className="boton-secundario px-3 py-1.5 text-xs">
            Anterior
          </Link>
          <Link href={query({ w: String(semanaHoy.isoWeek), y: String(semanaHoy.isoYear) })} className="boton-secundario px-3 py-1.5 text-xs">
            Esta semana
          </Link>
          <Link href={query({ w: String(semana.isoWeek + 1), y: String(semana.isoYear) })} className="boton-secundario px-3 py-1.5 text-xs">
            Siguiente
          </Link>
        </div>
      </div>

      <form className="tarjeta flex flex-wrap items-end gap-3 p-3" action="/control/partes" method="get">
        <input type="hidden" name="y" value={semana.isoYear} />
        <input type="hidden" name="w" value={semana.isoWeek} />
        <label className="text-xs font-medium text-slate-600">
          Estado
          <select name="estado" defaultValue={estado ?? ''} className="campo mt-1 py-1.5 text-sm">
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-slate-600">
          Proyecto
          <select name="proyecto" defaultValue={params.proyecto ?? ''} className="campo mt-1 max-w-64 py-1.5 text-sm">
            <option value="">Todos</option>
            {proyectos.map((proyecto) => (
              <option key={proyecto.id} value={proyecto.id}>
                {proyecto.codigo} · {proyecto.nombre}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="boton-primario py-1.5 text-xs">
          Filtrar
        </button>

        <div className="ml-auto flex items-center gap-2">
          {(['csv', 'xlsx', 'pdf'] as const).map((formato) => (
            <Link
              key={formato}
              href={`/control/partes/exportar?formato=${formato}&y=${semana.isoYear}&w=${semana.isoWeek}${estado ? `&estado=${estado}` : ''}${params.proyecto ? `&proyecto=${params.proyecto}` : ''}`}
              className="boton-secundario py-1.5 text-xs"
              prefetch={false}
            >
              {formato === 'csv' ? 'CSV' : formato.toUpperCase()}
            </Link>
          ))}
        </div>
      </form>

      {resultado.filas.length === 0 ? (
        <div className="tarjeta p-10 text-center">
          <p className="text-sm text-slate-600">No hay partes con estos filtros.</p>
        </div>
      ) : (
        <TablaPartes
          filas={resultado.filas.map((fila) => ({
            id: fila.id,
            version: fila.version,
            empleadoNombre: fila.empleadoNombre,
            empleadoCodigo: fila.empleadoCodigo,
            totalMinutos: fila.totalMinutos,
            estado: fila.estado,
            motivoRechazo: fila.motivoRechazo,
          }))}
        />
      )}

      {totalPaginas > 1 ? (
        <nav aria-label="Paginación" className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, indice) => indice + 1).map((numero) => (
            <Link
              key={numero}
              href={query({ pagina: String(numero) })}
              aria-current={numero === pagina ? 'page' : undefined}
              className={`rounded px-3 py-1 text-sm ${numero === pagina ? 'bg-marca-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`}
            >
              {numero}
            </Link>
          ))}
        </nav>
      ) : null}

      <p className="text-xs text-slate-500">
        Solo ves partes de los proyectos que tienes asignados. Los borradores se pueden consultar, pero no aprobar
        hasta que el trabajador los envíe.
      </p>
    </section>
  )
}
