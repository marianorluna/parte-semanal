import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import type { PersonaAtencion } from '@/modules/reporting/application/panel'
import {
  CLASES_CUMPLIMIENTO,
  ETIQUETAS_CUMPLIMIENTO,
  type ResumenCumplimiento,
} from '@/modules/reporting/domain/cumplimiento'
import {
  ETIQUETAS_SEVERIDAD,
  type Severidad,
} from '@/modules/reporting/domain/severidad'
import { EnlaceIcono } from '@/components/AccionesIcono'
import { Icono } from '@/components/Iconos'
import { TILE } from '@/components/leyenda/semaforo'
import { MenuExportar } from '@/components/MenuExportar'
import { TarjetaColapsable } from '@/components/TarjetaColapsable'
import { nombreArchivo } from '@/modules/reporting/infrastructure/exportadores/comun'

export type MetricasDashboard = {
  cumplimientoPct: number
  pendientes: number
  sinEnviar: number
  proyectosEnRiesgo: number
  totalMinutos: number
  partes: number
  empleados: number
  diasEspera: number
  proyectosActivos: number
  proyectosEnRitmo: number
  sinPresupuesto: number
}

type Tile = {
  etiqueta: string
  valor: string
  detalle: string
  severidad: Severidad
  href?: string
  icono: 'check' | 'bandeja' | 'usuarios' | 'alerta'
}

function TileMetrica({ tile }: { tile: Tile }) {
  const clases = TILE[tile.severidad]
  const contenido = (
    <div className={`flex h-full flex-col rounded-lg border p-3 ${clases.caja}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[11px] leading-tight font-medium tracking-wide text-white/80 uppercase">
          {tile.etiqueta}
        </p>
        <Icono nombre={tile.icono} className={`h-4 w-4 ${clases.icono}`} />
      </div>
      <p className="cifra mt-2 text-2xl leading-none font-bold text-white sm:text-3xl">{tile.valor}</p>
      <p className="mt-1 text-[11px] leading-tight text-marca-100">{tile.detalle}</p>
      {/* Reserva la altura de la píldora también cuando no hay aviso: así las
          cuatro tarjetas comparten la misma retícula vertical. */}
      <div className="mt-auto flex min-h-5 items-start pt-1.5">
        {tile.severidad !== 'NEUTRO' ? (
          <span className={`etiqueta ${clases.pastilla}`}>{ETIQUETAS_SEVERIDAD[tile.severidad]}</span>
        ) : null}
      </div>
    </div>
  )

  if (!tile.href) return contenido
  return (
    <Link href={tile.href} className="block rounded-lg transition-opacity hover:opacity-90">
      {contenido}
    </Link>
  )
}

/**
 * Cabecera operativa del panel: qué está bien, qué urge y a quién hay que
 * apoyar, todo legible en el primer pantallazo de un móvil.
 */
export function ResumenDashboard({
  isoYear,
  isoWeek,
  rango,
  navegacion,
  consultaExport,
  metricas,
  severidades,
  personas,
  cumplimiento,
  recordar,
  briefing,
}: {
  isoYear: number
  isoWeek: number
  rango: string
  navegacion: { anterior: string; siguiente: string; actual: string }
  consultaExport: string
  metricas: MetricasDashboard
  severidades: {
    cumplimiento: Severidad
    pendientes: Severidad
    sinEnviar: Severidad
    riesgo: Severidad
  }
  personas: PersonaAtencion[]
  cumplimiento: ResumenCumplimiento
  recordar: ReactNode
  /** Herramienta con IA que se muestra justo bajo el panel de control. */
  briefing?: ReactNode
}) {
  const tiles: Tile[] = [
    {
      etiqueta: 'Cumplimiento',
      valor: `${metricas.cumplimientoPct}%`,
      detalle: 'enviados o aprobados',
      severidad: severidades.cumplimiento,
      href: '/control/equipo',
      icono: 'check',
    },
    {
      etiqueta: 'Pendientes',
      valor: String(metricas.pendientes),
      detalle: 'sin revisar',
      severidad: severidades.pendientes,
      href: '/control/partes?estado=ENVIADO',
      icono: 'bandeja',
    },
    {
      etiqueta: 'Sin enviar',
      valor: String(metricas.sinEnviar),
      detalle: 'personas',
      severidad: severidades.sinEnviar,
      href: '/control/equipo?estado=SIN_PARTE',
      icono: 'usuarios',
    },
    {
      etiqueta: 'En riesgo',
      valor: String(metricas.proyectosEnRiesgo),
      detalle: 'proyectos',
      severidad: severidades.riesgo,
      href: '/control/proyectos',
      icono: 'alerta',
    },
  ]

  const urgentes = personas.slice(0, 5)
  const restantes = Math.max(0, personas.length - urgentes.length)

  return (
    <>
      <section className="superficie-hero space-y-4 p-4 sm:p-5" aria-label="Resumen del panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-acento-300 uppercase">Panel de control</p>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="cifra text-sm text-marca-100">
              Semana {isoWeek} de {isoYear} · {rango}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <EnlaceIcono
              href={navegacion.anterior}
              icono="flecha-izquierda"
              etiqueta="Semana anterior"
              variante="secundario"
              oscuro
              soloIcono
            />
            <Link
              href={navegacion.actual}
              className="inline-flex min-h-11 items-center rounded-md border border-marca-600 bg-marca-800/60 px-3 text-xs font-semibold text-white hover:bg-marca-700"
            >
              Esta semana
            </Link>
            <EnlaceIcono
              href={navegacion.siguiente}
              icono="flecha-derecha"
              etiqueta="Semana siguiente"
              variante="secundario"
              oscuro
              soloIcono
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {tiles.map((tile) => (
            <TileMetrica key={tile.etiqueta} tile={tile} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-marca-200">
          <span className="cifra">
            <strong className="text-white">{formatearHorasReloj(metricas.totalMinutos)}</strong> imputadas
          </span>
          <span className="cifra">
            <strong className="text-white">{metricas.partes}</strong> partes de{' '}
            <strong className="text-white">{metricas.empleados}</strong> empleados
          </span>
          <span className="cifra">
            Antigüedad máxima <strong className="text-white">{metricas.pendientes > 0 ? `${metricas.diasEspera} d` : '0 d'}</strong>
          </span>
          <span className="cifra">
            <strong className="text-white">{metricas.proyectosEnRitmo}</strong> proyectos en ritmo
            {metricas.sinPresupuesto > 0 ? ` · ${metricas.sinPresupuesto} sin datos` : ''}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <EnlaceIcono
            href="/control/partes?estado=ENVIADO"
            icono="bandeja"
            etiqueta="Partes pendientes"
            etiquetaCorta="Pendientes"
            contador={metricas.pendientes}
            variante="primario"
            oscuro
            className="w-full"
          />
          <EnlaceIcono
            href="/control/equipo"
            icono="usuarios"
            etiqueta="Equipo"
            variante="secundario"
            oscuro
            className="w-full"
          />
          <MenuExportar
            oscuro
            anchoCompleto
            acciones={[
              {
                formato: 'Excel',
                etiqueta: 'Exportar Excel',
                descripcion: 'Resumen, proyectos y avisos',
                href: `/control/dashboard/exportar?formato=xlsx&${consultaExport}`,
                archivo: nombreArchivo(`dashboard-${isoYear}-W${isoWeek}`, 'xlsx'),
                icono: 'hoja',
              },
              {
                formato: 'PDF',
                etiqueta: 'Exportar PDF',
                descripcion: 'Informe listo para imprimir',
                href: `/control/dashboard/exportar?formato=pdf&${consultaExport}`,
                archivo: nombreArchivo(`dashboard-${isoYear}-W${isoWeek}`, 'pdf'),
                icono: 'documento',
              },
            ]}
          />
        </div>
      </section>

      {briefing}

      <TarjetaColapsable
        titulo={
          <span className="flex items-center gap-1.5">
            <Icono nombre="alerta" className="h-4 w-4 text-amber-600" />
            Necesitan ayuda
            {personas.length > 0 ? (
              <span className="etiqueta bg-amber-100 text-amber-800">{personas.length}</span>
            ) : null}
          </span>
        }
        resumen={
          personas.length === 0
            ? 'Nadie tiene el parte pendiente esta semana'
            : `${personas.length} ${personas.length === 1 ? 'persona necesita' : 'personas necesitan'} atención`
        }
        accion={
          <Link href="/control/equipo" className="text-xs font-medium text-marca-700 hover:underline">
            Abrir equipo
          </Link>
        }
      >
        {urgentes.length === 0 ? (
          <p className="flex items-center gap-2 rounded-md bg-acento-50 px-3 py-2 text-sm text-acento-900">
            <Icono nombre="check" className="h-4 w-4" />
            Nadie tiene el parte pendiente en esta semana.
          </p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-slate-100">
              {urgentes.map((persona) => (
                <li key={persona.empleadoId} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{persona.nombre}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className={`etiqueta ${CLASES_CUMPLIMIENTO[persona.estado]}`}>
                        {ETIQUETAS_CUMPLIMIENTO[persona.estado]}
                      </span>
                      {persona.motivo ? (
                        <span className="line-clamp-1 text-[11px] text-red-700">{persona.motivo}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="cifra text-sm font-semibold text-slate-800">
                      {persona.minutos > 0 ? formatearHorasReloj(persona.minutos) : '0:00'}
                    </p>
                    <p
                      className={`cifra text-[11px] ${
                        persona.diasEspera >= 5
                          ? 'font-semibold text-red-700'
                          : persona.diasEspera >= 2
                            ? 'text-amber-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {persona.diasEspera} d
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {restantes > 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">y {restantes} más en Equipo.</p>
            ) : null}

            <div className="mt-3">{recordar}</div>
          </>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 text-[11px]">
          {(['APROBADO', 'ENVIADO', 'BORRADOR', 'RECHAZADO', 'SIN_PARTE'] as const).map((estado) => {
            const valor =
              estado === 'APROBADO'
                ? cumplimiento.aprobados
                : estado === 'ENVIADO'
                  ? cumplimiento.enviados
                  : estado === 'BORRADOR'
                    ? cumplimiento.borradores
                    : estado === 'RECHAZADO'
                      ? cumplimiento.rechazados
                      : cumplimiento.sinParte
            return (
              <span key={estado} className={`etiqueta ${CLASES_CUMPLIMIENTO[estado]}`}>
                {ETIQUETAS_CUMPLIMIENTO[estado]}: {valor}
              </span>
            )
          })}
          <span className="ml-auto text-slate-500">{cumplimiento.total} personas en tu ámbito</span>
        </div>
      </TarjetaColapsable>
    </>
  )
}
