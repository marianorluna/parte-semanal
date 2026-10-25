import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarProyectos, proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsPartes } from '@/composition'
import { formatearRango, hoyEnZona, semanaIsoDe, semanaIso, sumarDias } from '@/modules/partes/domain/fechas'
import { ESTADOS } from '@/modules/partes/domain/parte'
import { bandejaSoloTrabajadores } from '@/modules/partes/domain/permisos'
import { detalleCumplimientoDeSemana } from '@/modules/reporting/application/panel'
import { requiereAccionDelTrabajador } from '@/modules/reporting/domain/cumplimiento'
import { TablaPartes } from './TablaPartes'
import { ResumenPartes } from './ResumenPartes'
import { AccionesPartes } from './AccionesPartes'
import { FiltrosPartes } from './FiltrosPartes'

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

  const [resultado, proyectos, cumplimiento, aprobables] = await Promise.all([
    depsPartes.repo.listarParaControl({
      empresaId: usuario.empresaId,
      isoYear: semana.isoYear,
      isoWeek: semana.isoWeek,
      estado,
      proyectoId: params.proyecto,
      proyectosPermitidos: permitidos,
      soloTrabajadores: bandejaSoloTrabajadores(usuario.rol),
      pagina,
      porPagina,
    }),
    listarProyectos(usuario.empresaId),
    detalleCumplimientoDeSemana(usuario, semana, hoy),
    depsPartes.repo.listarEnviadosParaAprobar({
      empresaId: usuario.empresaId,
      isoYear: semana.isoYear,
      isoWeek: semana.isoWeek,
      proyectoId: params.proyecto,
      proyectosPermitidos: permitidos,
      soloTrabajadores: bandejaSoloTrabajadores(usuario.rol),
    }),
  ])

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

  const consultaExport = new URLSearchParams({
    y: String(semana.isoYear),
    w: String(semana.isoWeek),
    ...(estado ? { estado } : {}),
    ...(params.proyecto ? { proyecto: params.proyecto } : {}),
  }).toString()

  const recordables = cumplimiento.personas
    .filter((persona) => requiereAccionDelTrabajador(persona.estado))
    .map((persona) => persona.usuarioId)

  const anterior = semanaIsoDe(sumarDias(semana.weekStart, -7))
  const siguiente = semanaIsoDe(sumarDias(semana.weekStart, 7))
  const filtrosActivos = [estado, params.proyecto].filter(Boolean).length

  return (
    <section className="space-y-4">
      <ResumenPartes
        isoYear={semana.isoYear}
        isoWeek={semana.isoWeek}
        rango={formatearRango(semana.weekStart, semana.weekEnd)}
        navegacion={{
          anterior: query({ y: String(anterior.isoYear), w: String(anterior.isoWeek) }),
          siguiente: query({ y: String(siguiente.isoYear), w: String(siguiente.isoWeek) }),
          actual: query({ y: String(semanaHoy.isoYear), w: String(semanaHoy.isoWeek) }),
        }}
        cumplimiento={cumplimiento.resumen}
        totalPartes={resultado.total}
        totalMinutos={resultado.totalMinutos}
        consultaExport={consultaExport}
        enlaceEstado={(valor) => query({ estado: estado === valor ? '' : valor })}
        estadoActivo={estado}
        acciones={
          <AccionesPartes
            aprobables={aprobables.map((fila) => ({ parteId: fila.parteId, version: fila.version }))}
            recordables={recordables}
            isoYear={semana.isoYear}
            isoWeek={semana.isoWeek}
          />
        }
      />

      <FiltrosPartes
        isoYear={semana.isoYear}
        isoWeek={semana.isoWeek}
        estado={estado ?? ''}
        proyecto={params.proyecto ?? ''}
        proyectos={proyectos}
        activos={filtrosActivos}
      />

      <div id="bandeja" className="scroll-mt-24">
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
      </div>

      {totalPaginas > 1 ? (
        <nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, indice) => indice + 1).map((numero) => (
            <Link
              key={numero}
              href={query({ pagina: String(numero) })}
              aria-current={numero === pagina ? 'page' : undefined}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded px-3 text-sm ${
                numero === pagina ? 'bg-marca-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'
              }`}
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
