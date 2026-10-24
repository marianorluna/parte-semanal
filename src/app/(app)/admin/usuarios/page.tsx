import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import {
  listarEmpleadosDeEmpresa,
  listarProyectos,
  listarUsuarios,
} from '@/modules/identidad/infrastructure/repositorio-identidad'
import { FormularioNuevoUsuario } from './FormularioNuevoUsuario'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string }> }

export default async function AdminUsuariosPage({ searchParams }: Props) {
  const usuario = await requireRol('ADMIN')
  const params = await searchParams

  const [usuarios, proyectos, empleados] = await Promise.all([
    listarUsuarios(usuario.empresaId, params.q),
    listarProyectos(usuario.empresaId),
    listarEmpleadosDeEmpresa(usuario.empresaId),
  ])

  const conteo = {
    admin: usuarios.filter((u) => u.rol === 'ADMIN').length,
    encargado: usuarios.filter((u) => u.rol === 'ENCARGADO').length,
    trabajador: usuarios.filter((u) => u.rol === 'TRABAJADOR').length,
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-600">
          {usuarios.length} usuarios · {conteo.admin} administración · {conteo.encargado} encargados ·{' '}
          {conteo.trabajador} trabajadores
        </p>
      </div>

      <details className="tarjeta p-4">
        <summary className="cursor-pointer text-sm font-semibold text-marca-800">Dar de alta un usuario</summary>
        <div className="mt-4">
          <FormularioNuevoUsuario proyectos={proyectos} empleados={empleados} />
        </div>
      </details>

      <form className="flex flex-col gap-2 sm:flex-row" action="/admin/usuarios" method="get">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Buscar por nombre o email"
          className="campo max-w-sm"
        />
        <button type="submit" className="boton-secundario">
          Buscar
        </button>
        {params.q ? (
          <Link href="/admin/usuarios" className="boton-secundario">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className="tarjeta hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((fila) => (
              <tr key={fila.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/admin/usuarios/${fila.id}`} className="font-medium text-slate-900 hover:text-marca-700">
                    {fila.nombre}
                  </Link>
                  {fila.empresaCodigo === 'DEMO' ? (
                    <span className="ml-2 rounded bg-marca-100 px-1.5 py-0.5 text-[10px] font-semibold text-marca-800">
                      DEMO
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-600">{fila.email}</td>
                <td className="px-3 py-2">{fila.rol}</td>
                <td className="px-3 py-2 text-slate-600">
                  {fila.empleadoNombre ? `${fila.empleadoCodigo} · ${fila.empleadoNombre}` : 'Sin empleado'}
                </td>
                <td className="px-3 py-2">
                  <span className={`etiqueta ${fila.activo ? 'bg-acento-100 text-acento-800' : 'bg-slate-200 text-slate-600'}`}>
                    {fila.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {usuarios.map((fila) => (
          <li key={fila.id} className="tarjeta p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/admin/usuarios/${fila.id}`} className="min-w-0 hover:text-marca-700">
                <span className="block truncate font-medium text-slate-900">{fila.nombre}</span>
                <span className="block truncate text-xs text-slate-500">{fila.email}</span>
              </Link>
              <span
                className={`etiqueta shrink-0 ${fila.activo ? 'bg-acento-100 text-acento-800' : 'bg-slate-200 text-slate-600'}`}
              >
                {fila.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-500">Rol</dt>
                <dd className="text-slate-800">{fila.rol}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-slate-500">Empleado</dt>
                <dd className="truncate text-slate-800">
                  {fila.empleadoNombre ? `${fila.empleadoCodigo} · ${fila.empleadoNombre}` : 'Sin empleado'}
                </dd>
              </div>
            </dl>

            {fila.empresaCodigo === 'DEMO' ? (
              <span className="mt-2 inline-block rounded bg-marca-100 px-1.5 py-0.5 text-[10px] font-semibold text-marca-800">
                DEMO
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
