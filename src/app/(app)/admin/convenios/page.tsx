import { requireRol } from '@/modules/identidad/application/sesion'
import { listarEmpleadosDeEmpresa } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsComputo } from '@/composition'
import { listarAsignaciones, listarConvenios, obtenerConvenio } from '@/modules/computo/application/servicio'
import { ETIQUETAS_TIPO_HORA, formatearFactor, type TipoHora } from '@/modules/computo/domain/reglas'
import { hoyEnZona } from '@/modules/partes/domain/fechas'
import {
  BotonAlternarConvenio,
  BotonEliminarRegla,
  BotonQuitarAsignacionConvenio,
  FormularioAsignacionConvenio,
  FormularioConvenio,
  FormularioEdicionConvenio,
  FormularioRegla,
} from './FormulariosConvenio'

export const dynamic = 'force-dynamic'

function etiquetaAplica(aplicaEn: string): string {
  if (aplicaEn === 'LABORABLE') return 'Laborables'
  if (aplicaEn === 'FESTIVO') return 'Festivos'
  return 'Cualquier día'
}

function etiquetaTope(minutos: number | null): string {
  if (minutos === null) return 'Sin tope'
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

export default async function AdminConveniosPage() {
  const usuario = await requireRol('ADMIN')
  const resumenes = await listarConvenios(depsComputo, usuario)
  const convenios = await Promise.all(
    resumenes.map(async (resumen) => {
      const completo = await obtenerConvenio(depsComputo, resumen.id)
      return { ...resumen, reglas: completo?.reglas ?? [] }
    }),
  )
  const [empleados, asignaciones] = await Promise.all([
    listarEmpleadosDeEmpresa(usuario.empresaId),
    listarAsignaciones(depsComputo, usuario),
  ])
  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Convenios y cómputo</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Los factores se guardan en puntos básicos enteros y se congelan al aprobar cada parte:
          cambiar una regla no altera semanas cerradas. Sin convenio asignado se aplica factor 1.
        </p>
      </div>

      <details className="tarjeta p-4">
        <summary className="cursor-pointer text-sm font-semibold text-marca-800">Crear convenio</summary>
        <div className="mt-4">
          <FormularioConvenio />
        </div>
      </details>

      {convenios.length === 0 ? (
        <p className="tarjeta p-4 text-sm text-slate-600">
          Todavía no hay convenios. Mientras no exista ninguno, todos los minutos computan a factor 1.
        </p>
      ) : null}

      {convenios.map((convenio) => {
        const reglas = convenio.reglas
        const asignacionesDelConvenio = asignaciones.filter(
          (asignacion) => asignacion.convenioId === convenio.id,
        )

        return (
          <article key={convenio.id} className="tarjeta space-y-4 p-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{convenio.nombre}</h2>
                  <span className="etiqueta bg-marca-100 text-marca-800">{convenio.codigo}</span>
                  <span
                    className={`etiqueta ${convenio.activo ? 'bg-acento-100 text-acento-800' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {convenio.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Versión {convenio.version} · {reglas.length} reglas ·{' '}
                  {asignacionesDelConvenio.length} empleados asignados
                </p>
              </div>
              <BotonAlternarConvenio convenioId={convenio.id} activo={convenio.activo} />
            </header>

            <details>
              <summary className="cursor-pointer text-xs font-semibold text-marca-800">
                Editar datos del convenio
              </summary>
              <div className="mt-3">
                <FormularioEdicionConvenio
                  convenio={{ id: convenio.id, codigo: convenio.codigo, nombre: convenio.nombre }}
                />
              </div>
            </details>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Reglas</h3>
              {reglas.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Sin reglas: factor 1. Añade una para computar festivos, extras o topes.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Aplica en</th>
                        <th className="px-3 py-2 text-right">Factor</th>
                        <th className="px-3 py-2 text-right">Tope diario</th>
                        <th className="px-3 py-2 text-right">Tope semanal</th>
                        <th className="px-3 py-2 text-right">Prioridad</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {reglas.map((regla) => (
                        <tr key={regla.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {ETIQUETAS_TIPO_HORA[regla.tipoHora as TipoHora]}
                            {regla.requiereAutorizacion ? (
                              <span className="ml-2 etiqueta bg-amber-100 text-amber-800">Autorización</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{etiquetaAplica(regla.aplicaEn)}</td>
                          <td className="px-3 py-2 text-right font-mono">×{formatearFactor(regla.factorBps)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{etiquetaTope(regla.topeDiarioMin)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{etiquetaTope(regla.topeSemanalMin)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{regla.prioridad}</td>
                          <td className="px-3 py-2 text-right">
                            <BotonEliminarRegla convenioId={convenio.id} reglaId={regla.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <details>
              <summary className="cursor-pointer text-xs font-semibold text-marca-800">
                Añadir o actualizar una regla
              </summary>
              <div className="mt-3">
                <FormularioRegla convenioId={convenio.id} />
              </div>
            </details>

            <details>
              <summary className="cursor-pointer text-xs font-semibold text-marca-800">
                Asignar empleados
              </summary>
              <div className="mt-3 space-y-3">
                <FormularioAsignacionConvenio
                  convenioId={convenio.id}
                  empleados={empleados}
                  hoy={hoy}
                />
                {asignacionesDelConvenio.length === 0 ? (
                  <p className="text-xs text-slate-500">Ningún empleado asignado a este convenio.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {asignacionesDelConvenio.map((asignacion) => (
                      <li key={asignacion.id} className="flex items-center justify-between gap-2 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-slate-800">
                            {asignacion.empleadoCodigo} · {asignacion.empleadoNombre}
                          </span>
                          <span className="block text-xs text-slate-500">
                            Desde {asignacion.desde}
                            {asignacion.hasta ? ` hasta ${asignacion.hasta}` : ''}
                          </span>
                        </span>
                        <BotonQuitarAsignacionConvenio asignacionId={asignacion.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </article>
        )
      })}
    </section>
  )
}
