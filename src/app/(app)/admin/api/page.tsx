import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { depsIntegraciones } from '@/composition'
import {
  listarClavesApi,
  listarEntregas,
  listarWebhooks,
} from '@/modules/integraciones/application/servicio'
import {
  BotonEstadoWebhook,
  BotonRevocarClave,
  FormularioClave,
  FormularioWebhook,
} from './FormulariosApi'

export const dynamic = 'force-dynamic'

const ESTILO_ENTREGA: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  ENVIADO: 'bg-acento-100 text-acento-800',
  FALLIDO: 'bg-red-100 text-red-700',
  AGOTADO: 'bg-slate-200 text-slate-700',
}

const ETIQUETA_ENTREGA: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  ENVIADO: 'Enviado',
  FALLIDO: 'Fallido',
  AGOTADO: 'Agotado',
}

export default async function AdminApiPage() {
  const actor = await requireRol('ADMIN')
  const [claves, webhooks, entregas] = await Promise.all([
    listarClavesApi(depsIntegraciones, actor.empresaId),
    listarWebhooks(depsIntegraciones, actor.empresaId),
    listarEntregas(depsIntegraciones, actor.empresaId),
  ])

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">API y webhooks</h1>
          <p className="text-sm text-slate-600">
            Claves con alcance limitado y suscripciones firmadas a los cambios de estado de los partes.
          </p>
        </div>
        <Link
          href="/api/v1/openapi.json"
          target="_blank"
          className="boton-secundario px-3 py-1.5 text-xs"
        >
          Ver OpenAPI
        </Link>
      </div>

      <div className="tarjeta space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Claves de API</h2>
          <p className="text-xs text-slate-500">
            Se guarda solo un hash. Una clave revocada deja de autenticar de inmediato.
          </p>
        </div>

        {claves.length === 0 ? (
          <p className="text-sm text-slate-600">Todavía no hay claves.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Prefijo</th>
                  <th className="px-3 py-2 font-medium">Alcances</th>
                  <th className="px-3 py-2 font-medium">Último uso</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claves.map((clave) => (
                  <tr key={clave.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{clave.nombre}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      lv_{clave.prefijo}_…
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{clave.alcances.join(', ')}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                      {clave.ultimoUsoAt ? formatearFecha(clave.ultimoUsoAt) : 'Nunca'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {clave.activo ? (
                        <span className="etiqueta bg-acento-100 text-acento-800">Activa</span>
                      ) : (
                        <span className="etiqueta bg-slate-100 text-slate-600">Revocada</span>
                      )}
                      {clave.caducaAt ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          Caduca {formatearFecha(clave.caducaAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {clave.activo ? <BotonRevocarClave id={clave.id} /> : <span className="text-xs text-slate-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="rounded-md border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-marca-800">
            Nueva clave
          </summary>
          <div className="mt-3">
            <FormularioClave />
          </div>
        </details>
      </div>

      <div className="tarjeta space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Webhooks</h2>
          <p className="text-xs text-slate-500">
            Cada entrega se firma con HMAC-SHA256 sobre <code>timestamp.cuerpo</code> en la cabecera
            <code className="ml-1">X-Leviparte-Firma</code>. Los reintentos usan backoff exponencial.
          </p>
        </div>

        {webhooks.length === 0 ? (
          <p className="text-sm text-slate-600">Todavía no hay webhooks.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">URL</th>
                  <th className="px-3 py-2 font-medium">Eventos</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {webhooks.map((hook) => (
                  <tr key={hook.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{hook.nombre}</td>
                    <td className="max-w-72 truncate px-3 py-2 text-xs text-slate-600">{hook.url}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{hook.eventos.join(', ')}</td>
                    <td className="px-3 py-2 text-xs">
                      {hook.activo ? (
                        <span className="etiqueta bg-acento-100 text-acento-800">Activo</span>
                      ) : (
                        <span className="etiqueta bg-slate-100 text-slate-600">Inactivo</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <BotonEstadoWebhook id={hook.id} activo={hook.activo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="rounded-md border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-marca-800">
            Nuevo webhook
          </summary>
          <div className="mt-3">
            <FormularioWebhook />
          </div>
        </details>
      </div>

      <div className="tarjeta space-y-3 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-900">Últimas entregas</h2>
        {entregas.length === 0 ? (
          <p className="text-sm text-slate-600">No hay entregas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Webhook</th>
                  <th className="px-3 py-2 font-medium">Evento</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Intentos</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entregas.map((entrega) => (
                  <tr key={entrega.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{entrega.webhookNombre}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{entrega.evento}</td>
                    <td className="px-3 py-2">
                      <span className={`etiqueta ${ESTILO_ENTREGA[entrega.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                        {ETIQUETA_ENTREGA[entrega.estado] ?? entrega.estado}
                      </span>
                      {entrega.ultimoError ? (
                        <p className="mt-1 max-w-56 truncate text-[11px] text-red-600">
                          {entrega.ultimoError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{entrega.intentos}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                      {formatearFecha(entrega.enviadoAt ?? entrega.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
