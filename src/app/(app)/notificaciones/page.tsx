import Link from 'next/link'
import { requireUsuario } from '@/modules/identidad/application/sesion'
import { repositorioNotificaciones } from '@/composition'
import type { TipoNotificacion } from '@/db/schema'
import { marcarLeida, marcarTodasLeidas } from './actions'

export const dynamic = 'force-dynamic'

const POR_PAGINA = 20

const ESTILOS_TIPO: Record<TipoNotificacion, string> = {
  RECORDATORIO_PARTE: 'bg-amber-100 text-amber-800',
  EQUIPO_PENDIENTE: 'bg-marca-100 text-marca-800',
  RIESGO_PROYECTO: 'bg-red-100 text-red-800',
}

const ETIQUETAS_TIPO: Record<TipoNotificacion, string> = {
  RECORDATORIO_PARTE: 'Recordatorio',
  EQUIPO_PENDIENTE: 'Equipo',
  RIESGO_PROYECTO: 'Riesgo',
}

type Props = {
  searchParams: Promise<{ pagina?: string; pendientes?: string }>
}

export default async function NotificacionesPage({ searchParams }: Props) {
  const usuario = await requireUsuario()
  const params = await searchParams
  const pagina = Math.max(1, Number(params.pagina ?? '1') || 1)
  const soloNoLeidas = params.pendientes === '1'

  const resultado = await repositorioNotificaciones.listarPorUsuario(usuario.id, {
    soloNoLeidas,
    pagina,
    porPagina: POR_PAGINA,
  })

  const totalPaginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA))

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Avisos</h1>
          <p className="text-sm text-slate-600">
            {resultado.noLeidas === 0 ? 'Todo leído' : `${resultado.noLeidas} sin leer`} · recordatorios de horas y
            alertas de proyecto
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Link
            href="/notificaciones/preferencias"
            className="boton-secundario px-3 py-1.5 text-xs"
          >
            Preferencias
          </Link>
          <Link
            href={soloNoLeidas ? '/notificaciones' : '/notificaciones?pendientes=1'}
            className="boton-secundario px-3 py-1.5 text-xs"
          >
            {soloNoLeidas ? 'Ver todos' : 'Solo sin leer'}
          </Link>
          {resultado.noLeidas > 0 ? (
            <form action={marcarTodasLeidas} className="flex-1 sm:flex-none">
              <button type="submit" className="boton-secundario w-full px-3 py-1.5 text-xs">
                Marcar todas como leídas
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {resultado.filas.length === 0 ? (
        <div className="tarjeta p-8 text-center text-sm text-slate-600">
          No hay avisos. Cuando falten horas o un proyecto se desvíe, aparecerán aquí.
        </div>
      ) : (
        <ul className="space-y-2">
          {resultado.filas.map((fila) => {
            const noLeida = fila.leidaAt === null
            return (
              <li
                key={fila.id}
                className={`tarjeta p-4 ${noLeida ? 'border-l-4 border-l-acento-500' : 'opacity-80'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`etiqueta ${ESTILOS_TIPO[fila.tipo]}`}>{ETIQUETAS_TIPO[fila.tipo]}</span>
                      <h2 className="text-sm font-semibold text-slate-900">{fila.titulo}</h2>
                      {noLeida ? <span className="text-[11px] font-medium text-acento-700">nuevo</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{fila.cuerpo}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatearInstante(fila.createdAt)}</p>
                  </div>

                  <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                    {fila.url ? (
                      <Link href={fila.url} className="boton-primario flex-1 px-3 py-1.5 text-xs sm:flex-none">
                        Abrir
                      </Link>
                    ) : null}
                    {noLeida ? (
                      <form action={marcarLeida.bind(null, fila.id)} className="flex-1 sm:flex-none">
                        <button type="submit" className="boton-secundario w-full px-3 py-1.5 text-xs">
                          Marcar leída
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {totalPaginas > 1 ? (
        <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Paginación de avisos">
          {pagina > 1 ? (
            <Link
              href={`/notificaciones?pagina=${pagina - 1}${soloNoLeidas ? '&pendientes=1' : ''}`}
              className="boton-secundario px-3 py-1.5 text-xs"
            >
              Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-slate-500">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link
              href={`/notificaciones?pagina=${pagina + 1}${soloNoLeidas ? '&pendientes=1' : ''}`}
              className="boton-secundario px-3 py-1.5 text-xs"
            >
              Siguientes
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  )
}

function formatearInstante(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor)
}
