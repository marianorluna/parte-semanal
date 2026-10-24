import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { listarProyectos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { depsInformes } from '@/composition'
import { listarInformes, tokenDescarga } from '@/modules/informes/application/servicio'
import {
  ETIQUETAS_ESTADO_INFORME,
  ETIQUETAS_TIPO_INFORME,
  type EstadoInforme,
} from '@/modules/informes/domain/informe'
import { hoyEnZona } from '@/modules/partes/domain/fechas'
import { AutoRefrescar, BotonReintentar, FormularioInforme } from './FormulariosInforme'

export const dynamic = 'force-dynamic'

function estadoClase(estado: EstadoInforme): string {
  if (estado === 'COMPLETADO') return 'bg-acento-100 text-acento-800'
  if (estado === 'FALLIDO') return 'bg-red-100 text-red-800'
  if (estado === 'EN_PROCESO') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-200 text-slate-700'
}

function tamano(bytes: number | null): string {
  if (bytes === null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

function parametrosLegibles(parametros: Record<string, unknown>): string {
  if (parametros.anio !== undefined) return `${String(parametros.mes).padStart(2, '0')}/${parametros.anio}`
  return `${String(parametros.desde ?? '')} - ${String(parametros.hasta ?? '')}`
}

export default async function AdminInformesPage() {
  const usuario = await requireRol('ADMIN')
  const [informes, proyectos] = await Promise.all([
    listarInformes(depsInformes, usuario),
    listarProyectos(usuario.empresaId),
  ])
  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const secreto = process.env.AUTH_SECRET ?? ''
  const hayPendientes = informes.some(
    (informe) => informe.estado === 'PENDIENTE' || informe.estado === 'EN_PROCESO',
  )

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Informes</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Se generan en segundo plano con pg-boss: la petición solo encola. Los ficheros caducan
          a los 7 días y cada descarga usa un enlace firmado de 15 minutos. Máximo 10.000 filas
          por informe.
        </p>
      </div>

      <AutoRefrescar activo={hayPendientes} />

      <div className="tarjeta p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Solicitar informe</h2>
        <FormularioInforme proyectos={proyectos} hoy={hoy} />
      </div>

      <article className="tarjeta overflow-x-auto p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial</h2>
        {informes.length === 0 ? (
          <p className="text-sm text-slate-600">Todavía no has solicitado ningún informe.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs font-semibold tracking-wide text-marca-900 uppercase">
                <th className="px-3 py-2">Solicitado</th>
                <th className="px-3 py-2">Informe</th>
                <th className="px-3 py-2">Periodo</th>
                <th className="px-3 py-2">Formato</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Tamaño</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {informes.map((informe) => {
                const descarga =
                  informe.estado === 'COMPLETADO'
                    ? (() => {
                        const { token } = tokenDescarga(informe.id, secreto, depsInformes)
                        return `/admin/informes/${informe.id}/descarga?token=${encodeURIComponent(token)}`
                      })()
                    : null

                return (
                  <tr key={informe.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {informe.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-slate-800">
                        {ETIQUETAS_TIPO_INFORME[informe.tipo]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {informe.solicitanteNombre ?? 'Sistema'}
                        {informe.error ? ` · ${informe.error}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{parametrosLegibles(informe.parametros)}</td>
                    <td className="px-3 py-2 text-slate-600">{informe.formato}</td>
                    <td className="px-3 py-2">
                      <span className={`etiqueta ${estadoClase(informe.estado)}`}>
                        {ETIQUETAS_ESTADO_INFORME[informe.estado]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{tamano(informe.tamanoBytes)}</td>
                    <td className="px-3 py-2 text-right">
                      {descarga ? (
                        <Link href={descarga} className="text-xs font-medium text-marca-700 hover:underline">
                          Descargar
                        </Link>
                      ) : informe.estado === 'FALLIDO' ? (
                        <BotonReintentar informeId={informe.id} />
                      ) : (
                        <span className="text-xs text-slate-400">En curso</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </article>
    </section>
  )
}
