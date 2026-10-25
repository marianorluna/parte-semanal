import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarProyectos, proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { hoyEnZona, formatearRango, semanaIso, semanaIsoDe, sumarDias } from '@/modules/partes/domain/fechas'
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
import { Select } from '@/components/Select'
import { depsAusencias } from '@/composition'
import { ausenciasDeSemanaDeEmpleados } from '@/modules/ausencias/application/servicio'
import { AccionesLote } from './AccionesEquipo'
import { TablaEquipo, type FilaEquipo } from './TablaEquipo'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ y?: string; w?: string; proyecto?: string; estado?: string }>
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

  const [partes, asignaciones, ausenciasSemana] = await Promise.all([
    partesDeEmpleados(empleadoIds, semana.isoYear, semana.isoWeek),
    proyectosAsignadosEnSemana(empleadoIds, semana),
    ausenciasDeSemanaDeEmpleados(depsAusencias, empleadoIds, semana.weekStart, semana.weekEnd),
  ])

  const partePorEmpleado = new Map(partes.map((parte) => [parte.empleadoId, parte]))
  const proyectosPorEmpleado = new Map<string, string[]>()
  for (const asignacion of asignaciones) {
    const lista = proyectosPorEmpleado.get(asignacion.empleadoId) ?? []
    lista.push(asignacion.codigo)
    proyectosPorEmpleado.set(asignacion.empleadoId, lista)
  }

  const filas: FilaEquipo[] = miembros
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
        ausencias: ausenciasSemana.get(miembro.empleadoId) ?? [],
      }
    })
    .sort((a, b) => {
      const prioridad = prioridadCumplimiento(a.estado) - prioridadCumplimiento(b.estado)
      return prioridad !== 0 ? prioridad : a.nombre.localeCompare(b.nombre, 'es')
    })

  const resumen = resumirCumplimiento(filas.map((fila) => ({ estado: fila.estado })))
  const conAusencia = filas.filter((fila) => fila.ausencias.length > 0).length
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
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center">
          <Link
            href={query({ y: String(anterior.isoYear), w: String(anterior.isoWeek) })}
            className="boton-secundario w-full px-3 py-1.5 text-xs sm:w-auto"
          >
            Anterior
          </Link>
          <Link href="/control/equipo" className="boton-secundario w-full px-3 py-1.5 text-xs sm:w-auto">
            Esta semana
          </Link>
          <Link
            href={query({ y: String(siguiente.isoYear), w: String(siguiente.isoWeek) })}
            className="boton-secundario w-full px-3 py-1.5 text-xs sm:w-auto"
          >
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
        {conAusencia > 0 ? (
          <span className="text-xs text-slate-500">
            · {conAusencia} {conAusencia === 1 ? 'persona' : 'personas'} con ausencia aprobada esta
            semana
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-end">
          <input type="hidden" name="y" value={semana.isoYear} />
          <input type="hidden" name="w" value={semana.isoWeek} />
          <Select
            etiqueta="Proyecto"
            name="proyecto"
            valorInicial={proyectoId ?? ''}
            className="py-1.5 text-sm"
            classNameContenedor="w-full md:max-w-72"
            opciones={[
              { valor: '', etiqueta: 'Todos' },
              ...proyectos.map((proyecto) => ({
                valor: proyecto.id,
                etiqueta: `${proyecto.codigo} · ${proyecto.nombre}`,
              })),
            ]}
          />
          <Select
            etiqueta="Estado"
            name="estado"
            valorInicial={estadoFiltro ?? ''}
            className="py-1.5 text-sm"
            classNameContenedor="w-full md:w-56"
            opciones={[
              { valor: '', etiqueta: 'Todos' },
              ...ESTADOS_CUMPLIMIENTO.map((estado) => ({
                valor: estado,
                etiqueta: ETIQUETAS_CUMPLIMIENTO[estado],
              })),
            ]}
          />
          <button type="submit" className="boton-secundario boton-campo w-full px-3 text-xs sm:w-auto">
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

      <TablaEquipo filas={visibles} isoYear={semana.isoYear} isoWeek={semana.isoWeek} />

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
