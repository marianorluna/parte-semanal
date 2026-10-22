import { requireRol } from '@/modules/identidad/application/sesion'
import { resumenDemo } from '@/db/seed/demo'
import { AccionesDemo } from './AccionesDemo'

export const dynamic = 'force-dynamic'

const CUENTAS = [
  { rol: 'Administración', email: 'admin@demo.local' },
  { rol: 'Encargado', email: 'encargado1@demo.local' },
  { rol: 'Trabajador', email: 'trabajador01@demo.local' },
]

export default async function AdminDemoPage() {
  await requireRol('ADMIN')
  const resumen = await resumenDemo()

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Datos de demostración</h1>
        <p className="text-sm text-slate-600">
          Datos aislados bajo la empresa con código DEMO. Se pueden cargar y quitar sin afectar a datos reales.
        </p>
      </div>

      <div className="tarjeta p-4">
        <h2 className="text-sm font-semibold text-slate-900">Estado actual</h2>
        {resumen.existe ? (
          <p className="mt-1 text-sm text-slate-700">
            Demo presente: <strong>{resumen.usuarios} usuarios</strong> y <strong>{resumen.partes} partes</strong>.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-700">No hay datos de demostración cargados.</p>
        )}
      </div>

      <AccionesDemo existeDemo={resumen.existe} />

      <div className="tarjeta p-4">
        <h2 className="text-sm font-semibold text-slate-900">Cuentas de prueba</h2>
        <p className="mt-1 text-xs text-slate-600">
          Todas usan la contraseña configurada en <code>DEMO_PASSWORD</code> (por defecto <code>Demo1234!</code>).
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {CUENTAS.map((cuenta) => (
            <li key={cuenta.email} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1 last:border-0">
              <span className="text-slate-600">{cuenta.rol}</span>
              <code className="text-xs text-slate-800">{cuenta.email}</code>
            </li>
          ))}
          <li className="pt-1 text-xs text-slate-500">
            Encargados: encargado1 ... encargado6 · Trabajadores: trabajador01 ... trabajador43
          </li>
        </ul>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <p className="font-semibold">Cuándo usar la purga</p>
        <p className="mt-1">
          Antes de dar de alta usuarios reales conviene purgar el demo para no mezclar cuentas de prueba con la
          plantilla. La purga es transaccional y solo borra filas de la empresa DEMO.
        </p>
      </div>
    </section>
  )
}
