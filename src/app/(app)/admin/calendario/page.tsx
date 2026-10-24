import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarEmpleadosDeEmpresa } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsCalendario } from '@/composition'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { nombreDia } from '@/modules/partes/domain/fechas'
import {
  alternarCalendarioAction,
  alternarFestivoAction,
  eliminarExcepcionAction,
  eliminarFestivoAction,
  eliminarJornadaAction,
  quitarAsignacionAction,
} from './actions'
import {
  BotonAccion,
  FormularioAsignacion,
  FormularioCalendario,
  FormularioExcepcion,
  FormularioFestivo,
  FormularioGenerarFestivos,
  FormularioImportarFestivos,
  FormularioJornada,
} from './FormulariosCalendario'
import { nombreComunidad } from '@/modules/calendario/domain/festivos-espana'
import { normalizarDiasSemana } from '@/modules/calendario/domain/calendario'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ c?: string; anio?: string }>
}

const LETRAS_DIA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function fechaCorta(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`
}

export default async function AdminCalendarioPage({ searchParams }: Props) {
  const usuario = await requireRol('ADMIN')
  const params = await searchParams

  const [calendarios, empleados, asignaciones] = await Promise.all([
    depsCalendario.repo.listar(usuario.empresaId),
    listarEmpleadosDeEmpresa(usuario.empresaId),
    depsCalendario.repo.listarAsignaciones(usuario.empresaId),
  ])

  const seleccionadoId = params.c ?? calendarios[0]?.id
  const candidato = seleccionadoId ? await depsCalendario.repo.obtener(seleccionadoId) : null
  const detalle = candidato && candidato.empresaId === usuario.empresaId ? candidato : null
  const anio = Number(params.anio) || new Date().getFullYear()

  const asignacionesDelCalendario = detalle
    ? asignaciones.filter((asignacion) => asignacion.calendarioId === detalle.id)
    : []

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Calendario laboral</h1>
        <p className="text-sm text-slate-600">
          Define los días laborables, los festivos y la jornada teórica. La rejilla semanal bloquea los días no
          laborables y avisa de la desviación sin impedir el envío.
        </p>
      </div>

      {calendarios.length === 0 ? (
        <div className="tarjeta space-y-4 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Aún no hay ningún calendario</h2>
            <p className="mt-1 text-sm text-slate-600">
              Mientras no exista, la aplicación funciona como hasta ahora: lunes a viernes sin festivos. Crea el
              calendario de empresa y precarga los festivos del año.
            </p>
          </div>
          <FormularioCalendario />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="tarjeta p-3">
            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Calendarios</h2>
            <ul className="mt-2 space-y-1">
              {calendarios.map((calendario) => {
                const activo = calendario.id === detalle?.id
                return (
                  <li key={calendario.id}>
                    <Link
                      href={`/admin/calendario?c=${calendario.id}`}
                      aria-current={activo ? 'page' : undefined}
                      className={`block rounded-md px-2 py-2 text-sm transition-colors ${
                        activo ? 'bg-marca-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">{calendario.nombre}</span>
                        <span
                          className={`shrink-0 text-[11px] ${activo ? 'text-marca-100' : 'text-slate-400'}`}
                        >
                          v{calendario.version}
                        </span>
                      </span>
                      <span
                        className={`mt-0.5 flex flex-wrap gap-1 text-[11px] ${
                          activo ? 'text-marca-100' : 'text-slate-500'
                        }`}
                      >
                        <span>{calendario.festivos} festivos</span>
                        {calendario.esPredeterminado ? <span>· predeterminado</span> : null}
                        {!calendario.activo ? <span>· inactivo</span> : null}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {detalle ? (
            <div className="tarjeta space-y-2 p-3">
              <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Estado</h2>
              <p className="text-xs text-slate-600">
                Versión <strong>{detalle.version}</strong>. Cada cambio incrementa la versión; el parte guarda la
                que tenía al enviarse.
              </p>
              <BotonAccion
                accion={alternarCalendarioAction}
                campos={{ calendarioId: detalle.id, activo: detalle.activo ? 'false' : 'true' }}
                etiqueta={detalle.activo ? 'Desactivar calendario' : 'Activar calendario'}
              />
            </div>
          ) : null}

          <details className="tarjeta p-3">
            <summary className="cursor-pointer text-sm font-semibold text-marca-800">Crear otro calendario</summary>
            <div className="mt-3">
              <FormularioCalendario />
            </div>
          </details>
        </aside>

        {detalle ? (
          <div className="space-y-4">
            <div className="tarjeta p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">{detalle.nombre}</h2>
                <span className="text-xs text-slate-500">
                  {detalle.codigo}
                  {detalle.comunidad ? ` · ${nombreComunidad(detalle.comunidad) ?? detalle.comunidad}` : ''}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Días laborables</dt>
                  <dd className="font-medium text-slate-800">
                    {normalizarDiasSemana(detalle.diasSemana)
                      .map((dia) => LETRAS_DIA[dia - 1])
                      .join(' · ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Jornada diaria</dt>
                  <dd className="font-medium text-slate-800">
                    {detalle.horasDiariasMin ? formatearHorasReloj(detalle.horasDiariasMin) : 'Sin definir'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Vigencia</dt>
                  <dd className="font-medium text-slate-800">
                    {fechaCorta(detalle.vigenteDesde)}
                    {detalle.vigenteHasta ? ` - ${fechaCorta(detalle.vigenteHasta)}` : ' - sin fin'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Festivos</dt>
                  <dd className="font-medium text-slate-800">{detalle.festivos.length}</dd>
                </div>
              </dl>
            </div>

            <details className="tarjeta p-4">
              <summary className="cursor-pointer text-sm font-semibold text-marca-800">Editar calendario</summary>
              <div className="mt-4">
                <FormularioCalendario calendario={detalle} />
              </div>
            </details>

            <div className="tarjeta space-y-4 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Festivos</h2>
                <span className="text-xs text-slate-500">{detalle.festivos.length} registrados</span>
              </div>

              <FormularioGenerarFestivos calendarioId={detalle.id} anio={anio} />

              <details>
                <summary className="cursor-pointer text-xs font-semibold text-marca-800">
                  Añadir un festivo suelto
                </summary>
                <div className="mt-3">
                  <FormularioFestivo calendarioId={detalle.id} anio={anio} />
                </div>
              </details>

              <details>
                <summary className="cursor-pointer text-xs font-semibold text-marca-800">
                  Importar festivos desde CSV
                </summary>
                <div className="mt-3">
                  <FormularioImportarFestivos calendarioId={detalle.id} />
                </div>
              </details>

              {detalle.festivos.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                  Sin festivos. Precarga el año y revisa los traslados oficiales de tu comunidad y municipio.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Festivo</th>
                        <th className="px-3 py-2">Ámbito</th>
                        <th className="px-3 py-2">Origen</th>
                        <th className="px-3 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.festivos.map((festivo) => (
                        <tr key={festivo.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                            <span className="font-medium">{fechaCorta(festivo.fecha)}</span>
                            <span className="ml-2 text-xs text-slate-400 capitalize">
                              {nombreDia(festivo.fecha)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-800">{festivo.nombre}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{festivo.ambito}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{festivo.origen}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <BotonAccion
                                accion={alternarFestivoAction}
                                campos={{
                                  calendarioId: detalle.id,
                                  festivoId: festivo.id,
                                  fecha: festivo.fecha,
                                  nombre: festivo.nombre,
                                  ambito: festivo.ambito,
                                  esLaborable: festivo.esLaborable ? 'false' : 'true',
                                }}
                                etiqueta={festivo.esLaborable ? 'Cerrar' : 'Abrir'}
                              />
                              <BotonAccion
                                accion={eliminarFestivoAction}
                                campos={{
                                  calendarioId: detalle.id,
                                  festivoId: festivo.id,
                                  fecha: festivo.fecha,
                                }}
                                etiqueta="Eliminar"
                                variante="peligro"
                                confirmar={`¿Eliminar el festivo ${festivo.nombre} del ${fechaCorta(festivo.fecha)}?`}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="tarjeta space-y-3 p-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Excepciones puntuales</h2>
                <p className="text-xs text-slate-500">
                  Abre un sábado de inventario o cierra un puente sin tocar los festivos.
                </p>
              </div>

              <FormularioExcepcion calendarioId={detalle.id} />

              {detalle.excepciones.length === 0 ? (
                <p className="text-xs text-slate-500">Sin excepciones.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {detalle.excepciones.map((excepcion) => (
                    <li key={excepcion.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="text-slate-700">
                        <span className="font-medium">{fechaCorta(excepcion.fecha)}</span> · {excepcion.motivo}
                        <span
                          className={`etiqueta ml-2 ${
                            excepcion.laborable
                              ? 'bg-acento-100 text-acento-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {excepcion.laborable ? 'Laborable' : 'Cerrado'}
                        </span>
                      </span>
                      <BotonAccion
                        accion={eliminarExcepcionAction}
                        campos={{ calendarioId: detalle.id, excepcionId: excepcion.id }}
                        etiqueta="Quitar"
                        variante="peligro"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="tarjeta space-y-3 p-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Jornada teórica</h2>
                <p className="text-xs text-slate-500">
                  La jornada semanal se reparte entre los días laborables. Sin jornada no se avisa de desviación.
                </p>
              </div>

              <FormularioJornada calendarioId={detalle.id} empleados={empleados} />

              {detalle.jornadas.length === 0 ? (
                <p className="text-xs text-slate-500">Sin jornada teórica definida.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {detalle.jornadas.map((jornada) => {
                    const empleado = empleados.find((candidato) => candidato.id === jornada.empleadoId)
                    return (
                      <li key={jornada.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="text-slate-700">
                          <span className="font-medium">{empleado ? empleado.nombre : 'Toda la empresa'}</span>
                          {' · '}
                          {formatearHorasReloj(jornada.horasSemanalesMin)}/semana
                          {jornada.horasDiariasMin
                            ? ` · ${formatearHorasReloj(jornada.horasDiariasMin)}/día`
                            : ''}
                          <span className="ml-2 text-xs text-slate-500">
                            desde {fechaCorta(jornada.desde)}
                            {jornada.hasta ? ` hasta ${fechaCorta(jornada.hasta)}` : ''}
                          </span>
                        </span>
                        <BotonAccion
                          accion={eliminarJornadaAction}
                          campos={{ calendarioId: detalle.id, jornadaId: jornada.id }}
                          etiqueta="Quitar"
                          variante="peligro"
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="tarjeta space-y-3 p-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Empleados con este calendario</h2>
                <p className="text-xs text-slate-500">
                  Quien no tenga asignación usa el calendario marcado como predeterminado.
                </p>
              </div>

              <FormularioAsignacion calendarioId={detalle.id} empleados={empleados} />

              {asignacionesDelCalendario.length === 0 ? (
                <p className="text-xs text-slate-500">Sin asignaciones explícitas.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {asignacionesDelCalendario.map((asignacion) => (
                    <li
                      key={asignacion.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="text-slate-700">
                        <span className="font-medium">{asignacion.empleadoNombre}</span>
                        <span className="ml-2 text-xs text-slate-500">{asignacion.empleadoCodigo}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          desde {fechaCorta(asignacion.desde)}
                        </span>
                      </span>
                      <BotonAccion
                        accion={quitarAsignacionAction}
                        campos={{ asignacionId: asignacion.id }}
                        etiqueta="Quitar"
                        variante="peligro"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : calendarios.length > 0 ? (
          <p className="tarjeta p-4 text-sm text-slate-600">Selecciona un calendario a la izquierda.</p>
        ) : null}
      </div>
    </section>
  )
}
