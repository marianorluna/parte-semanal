import { requireRol } from '@/modules/identidad/application/sesion'
import { depsEmail } from '@/composition'
import { listarEnvios, resumenEnvios } from '@/modules/email/application/servicio'
import type { EstadoEmail } from '@/db/schema'
import { BotonReintentar } from './BotonReintentar'

export const dynamic = 'force-dynamic'

const ESTADOS: readonly EstadoEmail[] = ['PENDIENTE', 'ENVIADO', 'FALLIDO', 'SIN_PROVEEDOR']

const ETIQUETAS: Record<EstadoEmail, string> = {
  PENDIENTE: 'Pendiente',
  ENVIADO: 'Enviado',
  FALLIDO: 'Fallido',
  SIN_PROVEEDOR: 'Sin proveedor',
}

const ESTILOS: Record<EstadoEmail, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  ENVIADO: 'bg-acento-100 text-acento-800',
  FALLIDO: 'bg-red-100 text-red-700',
  SIN_PROVEEDOR: 'bg-slate-100 text-slate-600',
}

export default async function AdminEmailsPage() {
  const actor = await requireRol('ADMIN')
  const [envios, resumen] = await Promise.all([
    listarEnvios(depsEmail, actor.empresaId),
    resumenEnvios(depsEmail, actor.empresaId),
  ])

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Correos de aviso</h1>
        <p className="text-sm text-slate-600">
          Últimos envíos y estado de entrega. Sin SMTP_URL configurado los avisos quedan como «Sin
          proveedor».
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ESTADOS.map((estado) => (
          <div key={estado} className="tarjeta px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {ETIQUETAS[estado]}
            </p>
            <p className="text-lg font-semibold text-slate-900">{resumen[estado]}</p>
          </div>
        ))}
      </div>

      {envios.length === 0 ? (
        <div className="tarjeta p-8 text-center text-sm text-slate-600">
          Todavía no se ha generado ningún correo.
        </div>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Destinatario</th>
                <th className="px-3 py-2 font-medium">Asunto</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {envios.map((envio) => (
                <tr key={envio.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{envio.usuarioNombre}</p>
                    <p className="text-xs text-slate-500">{envio.destinatario}</p>
                  </td>
                  <td className="max-w-72 px-3 py-2">
                    <p className="truncate text-slate-700">{envio.asunto}</p>
                    {envio.ultimoError ? (
                      <p className="truncate text-[11px] text-red-600">{envio.ultimoError}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`etiqueta ${ESTILOS[envio.estado]}`}>
                      {ETIQUETAS[envio.estado]}
                    </span>
                    {envio.intentos > 0 ? (
                      <p className="mt-1 text-[11px] text-slate-500">{envio.intentos} intentos</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                    {formatearFecha(envio.enviadoAt ?? envio.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    {envio.estado === 'FALLIDO' || envio.estado === 'SIN_PROVEEDOR' ? (
                      <BotonReintentar emailId={envio.id} />
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function formatearFecha(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor)
}
