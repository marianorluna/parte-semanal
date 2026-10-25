import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarProyectos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { buscarUsuario, proyectosDeUsuario } from '@/modules/identidad/infrastructure/comandos-usuarios'
import { FormularioEditarUsuario, FormularioPassword } from './FormulariosEdicion'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function AdminUsuarioDetallePage({ params }: Props) {
  const actor = await requireRol('ADMIN')
  const { id } = await params

  const usuario = await buscarUsuario(id)
  if (!usuario || usuario.empresaId !== actor.empresaId) notFound()

  const [proyectos, asignados] = await Promise.all([
    listarProyectos(actor.empresaId),
    proyectosDeUsuario(usuario.id),
  ])

  return (
    <section className="space-y-4">
      <div>
        <Link href="/admin/usuarios" className="text-xs font-medium text-marca-700 hover:underline">
          Volver a usuarios
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{usuario.nombre}</h1>
        <p className="text-sm text-slate-600">{usuario.email}</p>
        {usuario.empresaCodigo === 'DEMO' ? (
          <p className="mt-1 inline-block rounded bg-marca-100 px-2 py-0.5 text-xs font-semibold text-marca-800">
            Cuenta de demostración
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="tarjeta p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Datos y permisos</h2>
          <FormularioEditarUsuario
            usuarioId={usuario.id}
            nombre={usuario.nombre}
            rol={usuario.rol}
            activo={usuario.activo}
            proyectos={proyectos}
            asignados={asignados}
          />
        </div>

        <div className="space-y-4">
          <div className="tarjeta p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Contraseña</h2>
            <FormularioPassword usuarioId={usuario.id} />
          </div>

          <div className="tarjeta p-4 text-xs text-slate-600">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Empleado vinculado</h2>
            {usuario.empleadoNombre ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-800">{usuario.empleadoNombre}</p>
                <p>
                  Código <span className="font-mono text-slate-700">{usuario.empleadoCodigo}</span>
                  {usuario.empleadoCategoria ? ` · ${usuario.empleadoCategoria}` : ''}
                </p>
              </div>
            ) : (
              <p>Sin empleado asignado</p>
            )}
            <p className="mt-2 text-slate-500">
              El vínculo con el empleado determina qué parte semanal ve el usuario. Se define al crear la cuenta.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
