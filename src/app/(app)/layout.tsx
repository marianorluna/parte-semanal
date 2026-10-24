import { requireUsuario } from '@/modules/identidad/application/sesion'
import { proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsPartes, repositorioNotificaciones } from '@/composition'
import { CampanaNotificaciones } from '@/components/CampanaNotificaciones'
import { NavegacionEscritorio, MenuNavegacion, type EnlaceNav } from './Navegacion'
import { cerrarSesion } from '@/app/login/actions'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario()
  const puedeControlar = usuario.rol === 'ADMIN' || usuario.rol === 'ENCARGADO'

  const pendientes = puedeControlar
    ? await depsPartes.repo.contarPendientes(usuario.empresaId, await proyectosPermitidos(usuario), {
        soloTrabajadores: usuario.rol === 'ENCARGADO',
      })
    : 0

  const noLeidas = await repositorioNotificaciones.contarNoLeidas(usuario.id)

  const enlaces: EnlaceNav[] = []
  if (usuario.empleadoId) enlaces.push({ href: '/mi-semana', etiqueta: 'Mi semana' })
  if (puedeControlar) {
    enlaces.push({ href: '/control/dashboard', etiqueta: 'Dashboard' })
    enlaces.push({ href: '/control/equipo', etiqueta: 'Equipo' })
    enlaces.push({ href: '/control/partes', etiqueta: 'Partes', contador: pendientes })
  }
  if (usuario.rol === 'ADMIN') {
    enlaces.push({ href: '/admin/usuarios', etiqueta: 'Usuarios' })
    enlaces.push({ href: '/admin/proyectos', etiqueta: 'Proyectos' })
    enlaces.push({ href: '/admin/calendario', etiqueta: 'Calendario' })
    enlaces.push({ href: '/admin/convenios', etiqueta: 'Convenios' })
    enlaces.push({ href: '/admin/auditoria', etiqueta: 'Auditoría' })
    enlaces.push({ href: '/admin/demo', etiqueta: 'Demo' })
  }

  return (
    <div className="min-h-dvh">
      <header className="no-imprimir sticky top-0 z-10 border-b-2 border-b-acento-600 bg-marca-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex shrink-0 items-baseline gap-2">
              <span className="text-xs font-semibold tracking-widest text-acento-300 uppercase">Levitec</span>
              <span className="hidden text-sm font-semibold text-white sm:inline">Parte semanal</span>
            </div>

            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <CampanaNotificaciones noLeidas={noLeidas} />
              <div className="hidden min-w-0 text-right sm:block">
                <p className="max-w-36 truncate text-sm leading-tight font-medium text-white md:max-w-56">
                  {usuario.nombre}
                </p>
                <p className="text-xs leading-tight text-marca-200">
                  {usuario.rol === 'ADMIN' ? 'Administrador' : usuario.rol === 'ENCARGADO' ? 'Encargado' : 'Trabajador'}
                </p>
              </div>
              <MenuNavegacion enlaces={enlaces} />
              <form action={cerrarSesion} className="shrink-0">
                <button
                  type="submit"
                  className="inline-flex h-9 cursor-pointer items-center rounded-md border border-marca-600 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-marca-800"
                >
                  Salir
                </button>
              </form>
            </div>
          </div>

          <NavegacionEscritorio enlaces={enlaces} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
