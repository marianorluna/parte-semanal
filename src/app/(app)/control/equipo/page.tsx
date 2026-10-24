import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarProyectos, proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { hoyEnZona, formatearRango, semanaIso, semanaIsoDe, sumarDias } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import {
  CLASES_CUMPLIMIENTO,
  ESTADOS_CUMPLIMIENTO,
  ETIQUETAS_CUMPLIMIENTO,
  prioridadCumplimiento,
  requiereAccionDelTrabajador,
  resumirCumplimiento,
  type EstadoCumplimiento,
} from '@/modules/reporting/domain/cumplimiento'
import {
  miembrosEquipo,
  partesDeEmpleados,
  proyectosAsignadosEnSemana,
} from '@/modules/reporting/infrastructure/consultas'
import { AccionesLote, BotonAprobar, BotonRecordar } from './AccionesEquipo'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ y?: string; w?: string; proyecto?: string; estado?: string }>
}

type Fila = {
  empleadoId: string
  usuarioId: string
  nombre: string
  email: string
  codigo: string
  rol: string
  proyectos: string[]
  estado: EstadoCumplimiento
  parteId: string | null
  version: number | null
  minutos: number
}

export default async function EquipoPage({ searchParams }: Props) {
  const usuario = await requireRol('ADMIN', 'ENCARGADO')
  const params = await searchParams

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaHoy = semanaIsoDe(hoy)

  const semana = (() => {
    try {
      return semanaIso(Number(params.y ?? semanaHoy.isoYear), Number(params.w ?? semanaHoy.isoWeek))
    } catch {
      return semanaHoy
    }
  })()

  const permitidos = await proyectosPermitidos(usuario)
  const todosLosProyectos = await listarProyectos(usuario.empresaId)
  const proyectos = permitidos === null ? todosLosProyectos : todosLosProyectos.filter((p) => permitidos.includes(p.id))
  const proyectoId = proyectos.find((p) => p.id === params.proyecto)?.id

  const estadoFiltro = ESTADOS_CUMPLIMIENTO.find((estado) => estado === params.estado)

  const miembros = await miembrosEquipo(usuario.empresaId, semana, {
    encargadoUsuarioId: usuario.rol === 'ENCARGADO' ? usuario.id : null,
    proyectoId,
  })
  const empleadoIds = miembros.map((miembro) => miembro.empleadoId)

  const [partes, asignaciones] = await Promise.all([
    partesDeEmpleados(empleadoIds, semana.isoYear, semana.isoWeek),
    proyectosAsignadosEnSemana(empleadoIds, semana),
  ])

  const partePorEmpleado = new Map(partes.map((parte) => [parte.empleadoId, parte]))
  const proyectosPorEmpleado = new Map<string, string[]>()
  for (const asignacion of asignaciones) {
    const lista = proyectosPorEmpleado.get(asignacion.empleadoId) ?? []
    lista.push(asignacion.codigo)
    proyectosPorEmpleado.set(asignacion.empleadoId, lista)
  }

  const filas: Fila[] = miembros
    .map((miembro) => {
      const parte = partePorEmpleado.get(miembro.empleadoId)
      return {
        empleadoId: miembro.empleadoId,
        usuarioId: miembro.usuarioId,
        nombre: miembro.nombre,
        email: miembro.email,
        codigo: miembro.codigo,
        rol: miembro.rol,
        proyectos: proyectosPorEmpleado.get(miembro.empleadoId) ?? [],
        estado: (parte?.estado ?? 'SIN_PARTE') as EstadoCumplimiento,
        parteId: parte?.parteId ?? null,
        version: parte?.version ?? null,
        minutos: parte?.totalMinutos ?? 0,
      }
    })
    .sort((a, b) => {
      const prioridad = prioridadCumplimiento(a.estado) - prioridadCumplimiento(b.estado)
      return prioridad !== 0 ? prioridad : a.nombre.localeCompare(b.nombre, 'es')
    })

  const resumen = resumirCumplimiento(filas.map((fila) => ({ estado: fila.estado })))
  const visibles = estadoFiltro ? filas.filter((fila) => fila.estado === estadoFiltro) : filas

  const aprobables = filas
    .filter((fila) => fila.estado === 'ENVIADO' && fila.parteId && fila.version !== null)
    .map((fila) => ({ parteId: fila.parteId as string, version: fila.version as number }))
  const recordables = filas
    .filter((fila) => requiereAccionDelTrabajador(fila.estado))
    .map((fila) => fila.usuarioId)

  const query = (cambios: Record<string, string | undefined>) => {
    const valores: Record<string, string> = {
      y: String(semana.isoYear),
      w: String(semana.isoWeek),
      proyecto: proyectoId ?? '',
      estado: estadoFiltro ?? '',
      ...cambios,
    }
    const base = new URLSearchParams()
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor) base.set(clave, valor)
    }
    const texto = base.toString()
    return texto ? `?${texto}` : ''
  }

  const anterior = semanaIsoDe(sumarDias(semana.weekStart, -7))
  const siguiente = semanaIsoDe(sumarDias(semana.weekStart, 7))

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Equipo</h1>
          <p className="text-sm text-slate-600">
            Semana {semana.isoWeek} de {semana.isoYear} · {formatearRango(semana.weekStart, semana.weekEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={query({ y: String(anterior.isoYear), w: String(anterior.isoWeek) })} className="boton-secundario px-3 py-1.5 text-xs">
            Anterior
          </Link>
          <Link href="/control/equipo" className="boton-secundario px-3 py-1.5 text-xs">
            Esta semana
          </Link>
          <Link href={query({ y: String(siguiente.isoYear), w: String(siguiente.isoWeek) })} className="boton-secundario px-3 py-1.5 text-xs">
            Siguiente
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip estado="APROBADO" valor={resumen.aprobados} query={query} activo={estadoFiltro === 'APROBADO'} />
        <Chip estado="ENVIADO" valor={resumen.enviados} query={query} activo={estadoFiltro === 'ENVIADO'} />
        <Chip estado="BORRADOR" valor={resumen.borradores} query={query} activo={estadoFiltro === 'BORRADOR'} />
        <Chip estado="RECHAZADO" valor={resumen.rechazados} query={query} activo={estadoFiltro === 'RECHAZADO'} />
        <Chip estado="SIN_PARTE" valor={resumen.sinParte} query={query} activo={estadoFiltro === 'SIN_PARTE'} />
        <span className="ml-2 text-xs text-slate-500">
          {resumen.cumplimientoPct}% del equipo ha enviado o tiene aprobado el parte
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="y" value={semana.isoYear} />
          <input type="hidden" name="w" value={semana.isoWeek} />
          <label className="text-xs font-medium text-slate-600">
            Proyecto
            <select name="proyecto" defaultValue={proyectoId ?? ''} className="campo mt-1 block py-1.5 text-sm">
              <option value="">Todos</option>
              {proyectos.map((proyecto) => (
                <option key={proyecto.id} value={proyecto.id}>
                  {proyecto.codigo} · {proyecto.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Estado
            <select name="estado" defaultValue={estadoFiltro ?? ''} className="campo mt-1 block py-1.5 text-sm">
              <option value="">Todos</option>
              {ESTADOS_CUMPLIMIENTO.map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETAS_CUMPLIMIENTO[estado]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="boton-secundario px-3 py-1.5 text-xs">
            Filtrar
          </button>
        </form>

        <AccionesLote
          aprobables={aprobables}
          recordables={recordables}
          isoYear={semana.isoYear}
          isoWeek={semana.isoWeek}
        />
      </div>

      <div className="tarjeta overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2">Proyectos</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Horas</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila) => (
              <tr key={fila.empleadoId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <span className="block font-medium text-slate-900">{fila.nombre}</span>
                  <span className="block text-xs text-slate-500">
                    {fila.codigo}
                    {fila.rol !== 'TRABAJADOR' ? ` · ${fila.rol === 'ADMIN' ? 'Administrador' : 'Encargado'}` : ''}
                  </span>
                </td>
                <td className="max-w-64 px-3 py-2 text-xs text-slate-600">
                  {fila.proyectos.length > 0 ? fila.proyectos.join(', ') : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`etiqueta ${CLASES_CUMPLIMIENTO[fila.estado]}`}>
                    {ETIQUETAS_CUMPLIMIENTO[fila.estado]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono">{fila.minutos > 0 ? formatearHorasReloj(fila.minutos) : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {fila.parteId ? (
                      <Link href={`/control/partes/${fila.parteId}`} className="boton-secundario px-2.5 py-1 text-xs">
                        Ver parte
                      </Link>
                    ) : null}
                    {fila.estado === 'ENVIADO' && fila.parteId && fila.version !== null ? (
                      <BotonAprobar
                        parteId={fila.parteId}
                        version={fila.version}
                        isoYear={semana.isoYear}
                        isoWeek={semana.isoWeek}
                      />
                    ) : null}
                    {requiereAccionDelTrabajador(fila.estado) ? (
                      <BotonRecordar usuarioId={fila.usuarioId} isoYear={semana.isoYear} isoWeek={semana.isoWeek} />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                  No hay personas que coincidan con el filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        El recordatorio llega al centro de avisos de cada persona. Solo se envía uno al día por persona y semana.
      </p>
    </section>
  )
}

function Chip({
  estado,
  valor,
  query,
  activo,
}: {
  estado: EstadoCumplimiento
  valor: number
  query: (cambios: Record<string, string | undefined>) => string
  activo: boolean
}) {
  return (
    <Link
      href={query({ estado: activo ? '' : estado })}
      className={`etiqueta border ${CLASES_CUMPLIMIENTO[estado]} ${
        activo ? 'ring-2 ring-marca-600 ring-offset-1' : 'border-transparent'
      }`}
      aria-pressed={activo}
    >
      {ETIQUETAS_CUMPLIMIENTO[estado]}: {valor}
    </Link>
  )
}
