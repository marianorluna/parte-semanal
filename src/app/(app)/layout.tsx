import { requireUsuario } from '@/modules/identidad/application/sesion'
import { proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsPartes, repositorioNotificaciones } from '@/composition'
import { LeyendaDashboard } from '@/components/leyenda/LeyendaDashboard'
import { Marca } from '@/components/Marca'
import { NavegacionEscritorio, MenuNavegacion } from './Navegacion'
import { NavegacionMovil } from './NavegacionMovil'
import { MenuUsuario } from './MenuUsuario'
import type { ItemNav } from './navegacion-modelo'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario()
  const puedeControlar = usuario.rol === 'ADMIN' || usuario.rol === 'ENCARGADO'
  const rolVisible =
    usuario.rol === 'ADMIN' ? 'Administrador' : usuario.rol === 'ENCARGADO' ? 'Encargado' : 'Trabajador'
  const datosUsuario = { nombre: usuario.nombre, rol: rolVisible }

  const pendientes = puedeControlar
    ? await depsPartes.repo.contarPendientes(usuario.empresaId, await proyectosPermitidos(usuario), {
        soloTrabajadores: usuario.rol === 'ENCARGADO',
      })
    : 0

  const noLeidas = await repositorioNotificaciones.contarNoLeidas(usuario.id)

  const items: ItemNav[] = []
  if (usuario.empleadoId) items.push({ href: '/mi-semana', etiqueta: 'Mi semana' })
  if (usuario.empleadoId) items.push({ href: '/mis-ausencias', etiqueta: 'Mis ausencias' })

  // Encargado y trabajador conservan la barra plana: tienen pocas secciones.
  if (usuario.rol === 'ENCARGADO') {
    items.push(
      { href: '/control/dashboard', etiqueta: 'Dashboard' },
      { href: '/control/equipo', etiqueta: 'Equipo' },
      { href: '/control/partes', etiqueta: 'Partes', contador: pendientes },
      { href: '/control/ausencias', etiqueta: 'Ausencias' },
    )
  }

  // Admin: cuatro grupos para no exponer 16 secciones de golpe.
  if (usuario.rol === 'ADMIN') {
    items.push(
      {
        etiqueta: 'Control',
        enlaces: [
          {
            href: '/control/dashboard',
            etiqueta: 'Dashboard',
            descripcion: 'Horas por proyecto, tendencia y top 5 del periodo',
          },
          {
            href: '/control/partes',
            etiqueta: 'Partes',
            descripcion: 'Revisar, aprobar o rechazar los partes de la semana',
            contador: pendientes,
          },
          {
            href: '/control/equipo',
            etiqueta: 'Equipo',
            descripcion: 'Estado de los partes de cada trabajador por semana',
          },
          {
            href: '/control/ausencias',
            etiqueta: 'Ausencias del equipo',
            descripcion: 'Vacaciones y bajas registradas por el equipo',
          },
          {
            href: '/control/proyectos',
            etiqueta: 'Proyectos en riesgo',
            descripcion: 'Consumo acumulado frente a presupuesto y plazo',
          },
        ],
      },
      {
        etiqueta: 'Configuración',
        enlaces: [
          {
            href: '/admin/usuarios',
            etiqueta: 'Usuarios',
            descripcion: 'Altas, roles y vínculo con el empleado',
          },
          {
            href: '/admin/proyectos',
            etiqueta: 'Proyectos y tareas',
            descripcion: 'Catálogo de proyectos, tareas y asignaciones',
          },
          {
            href: '/admin/calendario',
            etiqueta: 'Calendario laboral',
            descripcion: 'Festivos, jornada teórica y excepciones',
          },
          {
            href: '/admin/convenios',
            etiqueta: 'Convenios y cómputo',
            descripcion: 'Reglas de cómputo de horas por convenio',
          },
          {
            href: '/admin/ausencias',
            etiqueta: 'Tipos de ausencia',
            descripcion: 'Tipos, saldos y su consumo',
          },
        ],
      },
      {
        etiqueta: 'Análisis',
        enlaces: [
          {
            href: '/admin/costes',
            etiqueta: 'Coste y presupuestos',
            descripcion: 'Tarifas por hora y presupuesto de cada proyecto',
          },
          {
            href: '/admin/informes',
            etiqueta: 'Informes',
            descripcion: 'Exportaciones generadas en segundo plano',
          },
          {
            href: '/admin/cierres',
            etiqueta: 'Cierres de periodo',
            descripcion: 'Cierre semanal y mensual con reapertura auditada',
          },
        ],
      },
      {
        etiqueta: 'Sistema',
        enlaces: [
          {
            href: '/admin/emails',
            etiqueta: 'Correos de aviso',
            descripcion: 'Últimos envíos y estado de entrega',
          },
          {
            href: '/admin/api',
            etiqueta: 'API y webhooks',
            descripcion: 'Claves de integración y suscripciones firmadas',
          },
          {
            href: '/admin/auditoria',
            etiqueta: 'Auditoría',
            descripcion: 'Registro append-only de cambios',
          },
          {
            href: '/admin/demo',
            etiqueta: 'Datos de demostración',
            descripcion: 'Cargar o purgar el entorno de demo',
          },
        ],
      },
    )
  }

  return (
    <div className="min-h-dvh">
      <header className="no-imprimir sticky top-0 z-10 border-b-2 border-b-acento-600 bg-marca-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex shrink-0 items-baseline gap-2">
              <Marca className="text-xs" />
              <span className="hidden text-sm font-semibold text-white sm:inline">Parte semanal</span>
            </div>

            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <MenuUsuario
                usuario={datosUsuario}
                noLeidas={noLeidas}
                leyenda={puedeControlar ? <LeyendaDashboard /> : undefined}
              />
              <MenuNavegacion items={items} usuario={datosUsuario} />
            </div>
          </div>

          <NavegacionEscritorio items={items} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:pb-6">{children}</main>

      <NavegacionMovil
        items={items}
        rol={usuario.rol}
        usuario={datosUsuario}
        pendientes={pendientes}
        noLeidas={noLeidas}
        tieneEmpleado={Boolean(usuario.empleadoId)}
      />
    </div>
  )
}
