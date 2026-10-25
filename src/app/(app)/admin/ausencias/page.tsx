import { requireRol } from '@/modules/identidad/application/sesion'
import { listarEmpleadosDeEmpresa } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsAusencias } from '@/composition'
import { anioActual, listarSaldos, listarTipos } from '@/modules/ausencias/application/servicio'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import {
  BotonAlternarTipo,
  FormularioEdicionTipo,
  FormularioSaldo,
  FormularioTipo,
} from './FormulariosAusenciasAdmin'
import { AvisoOrigenRrhh } from '@/components/AvisoOrigenRrhh'

export const dynamic = 'force-dynamic'

export default async function AdminAusenciasPage() {
  const usuario = await requireRol('ADMIN')
  const [tipos, empleados, saldos] = await Promise.all([
    listarTipos(depsAusencias, usuario),
    listarEmpleadosDeEmpresa(usuario.empresaId),
    listarSaldos(depsAusencias, usuario),
  ])
  const anio = anioActual()

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tipos de ausencia y saldos</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Los tipos con «computa saldo» descuentan del saldo anual de vacaciones, repartiendo el
          consumo por fecha. Una ausencia de jornada completa bloquea el día en la rejilla; una
          parcial solo reduce la jornada teórica.
        </p>
      </div>

      <AvisoOrigenRrhh contexto="gestion" />

      <details className="tarjeta p-4" open={tipos.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-marca-800">Crear tipo</summary>
        <div className="mt-4">
          <FormularioTipo />
        </div>
      </details>

      <div className="space-y-3">
        {tipos.length === 0 ? (
          <p className="tarjeta p-4 text-sm text-slate-600">
            No hay tipos configurados. Sin tipos, los trabajadores no pueden solicitar ausencias.
          </p>
        ) : (
          tipos.map((tipo) => (
            <article key={tipo.id} className="tarjeta space-y-3 p-4">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{tipo.nombre}</h2>
                  <span className="etiqueta bg-marca-100 text-marca-800">{tipo.codigo}</span>
                  <span
                    className={`etiqueta ${tipo.activo ? 'bg-acento-100 text-acento-800' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {tipo.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  {tipo.computaSaldo ? (
                    <span className="etiqueta bg-amber-100 text-amber-800">Computa saldo</span>
                  ) : null}
                </div>
                <BotonAlternarTipo tipoId={tipo.id} activo={tipo.activo} />
              </header>

              <details>
                <summary className="cursor-pointer text-xs font-semibold text-marca-800">Editar</summary>
                <div className="mt-3">
                  <FormularioEdicionTipo
                    tipo={{
                      id: tipo.id,
                      codigo: tipo.codigo,
                      nombre: tipo.nombre,
                      computaSaldo: tipo.computaSaldo,
                      requiereAprobacion: tipo.requiereAprobacion,
                    }}
                  />
                </div>
              </details>
            </article>
          ))
        )}
      </div>

      <div className="tarjeta p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Saldo anual de vacaciones</h2>
        <FormularioSaldo
          empleados={empleados.map((empleado) => ({
            id: empleado.id,
            codigo: empleado.codigo,
            nombre: empleado.nombre,
          }))}
          anio={anio}
        />

        <div className="mt-4">
          {saldos.length === 0 ? (
            <p className="text-xs text-slate-500">Todavía no hay saldos configurados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
                    <th className="px-3 py-2">Empleado</th>
                    <th className="px-3 py-2 text-right">Año</th>
                    <th className="px-3 py-2 text-right">Asignado</th>
                    <th className="px-3 py-2 text-right">Arrastrado</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.map((saldo) => (
                    <tr key={saldo.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-800">
                        {saldo.empleadoCodigo} · {saldo.empleadoNombre}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{saldo.anio}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatearHorasReloj(saldo.minutosAsignados)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatearHorasReloj(saldo.minutosArrastrados)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
