import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import {
  CLASES_CUMPLIMIENTO,
  ETIQUETAS_CUMPLIMIENTO,
  type EstadoCumplimiento,
  type ResumenCumplimiento,
} from '@/modules/reporting/domain/cumplimiento'
import { EnlaceIcono } from '@/components/AccionesIcono'
import { Icono } from '@/components/Iconos'

const SEGMENTOS: { estado: EstadoCumplimiento; clase: string }[] = [
  { estado: 'APROBADO', clase: 'bg-acento-500' },
  { estado: 'ENVIADO', clase: 'bg-amber-400' },
  { estado: 'BORRADOR', clase: 'bg-slate-400' },
  { estado: 'RECHAZADO', clase: 'bg-red-500' },
  { estado: 'SIN_PARTE', clase: 'bg-slate-300' },
]

function valorDe(estado: EstadoCumplimiento, resumen: ResumenCumplimiento): number {
  switch (estado) {
    case 'APROBADO':
      return resumen.aprobados
    case 'ENVIADO':
      return resumen.enviados
    case 'BORRADOR':
      return resumen.borradores
    case 'RECHAZADO':
      return resumen.rechazados
    default:
      return resumen.sinParte
  }
}

/**
 * Cabecera de la bandeja: cuánto está listo, qué falta y las acciones masivas.
 * El orden de los segmentos va de lo resuelto a lo que bloquea el cierre.
 */
export function ResumenPartes({
  isoYear,
  isoWeek,
  rango,
  navegacion,
  cumplimiento,
  totalPartes,
  totalMinutos,
  consultaExport,
  enlaceEstado,
  estadoActivo,
  acciones,
}: {
  isoYear: number
  isoWeek: number
  rango: string
  navegacion: { anterior: string; siguiente: string; actual: string }
  cumplimiento: ResumenCumplimiento
  totalPartes: number
  totalMinutos: number
  consultaExport: string
  enlaceEstado: (estado: EstadoCumplimiento) => string
  estadoActivo?: EstadoCumplimiento
  acciones: ReactNode
}) {
  const total = Math.max(cumplimiento.total, 1)

  return (
    <section className="superficie-hero space-y-4 p-4 sm:p-5" aria-label="Resumen de partes">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-acento-300 uppercase">Revisión semanal</p>
          <h1 className="text-2xl font-bold">Partes de la semana</h1>
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <p className="cifra text-4xl leading-none font-bold sm:text-5xl">{cumplimiento.cumplimientoPct}%</p>
          <p className="pb-1 text-xs text-marca-100">
            del equipo con el parte
            <br />
            enviado o aprobado
          </p>
        </div>
        <p className="cifra text-xs text-marca-200">
          <strong className="text-white">{totalPartes}</strong> partes · {formatearHorasReloj(totalMinutos)}
        </p>
      </div>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-marca-950/50"
        role="img"
        aria-label={`Aprobados ${cumplimiento.aprobados}, enviados ${cumplimiento.enviados}, borradores ${cumplimiento.borradores}, rechazados ${cumplimiento.rechazados}, sin parte ${cumplimiento.sinParte}`}
      >
        {SEGMENTOS.map(({ estado, clase }) => {
          const valor = valorDe(estado, cumplimiento)
          if (valor === 0) return null
          return (
            <span
              key={estado}
              className={`h-full ${clase}`}
              style={{ width: `${(valor / total) * 100}%` }}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SEGMENTOS.map(({ estado }) => {
          const activo = estadoActivo === estado
          return (
            <Link
              key={estado}
              href={enlaceEstado(estado)}
              aria-pressed={activo}
              className={`etiqueta ${CLASES_CUMPLIMIENTO[estado]} ${
                activo ? 'ring-2 ring-white ring-offset-2 ring-offset-marca-800' : 'opacity-90 hover:opacity-100'
              }`}
            >
              {ETIQUETAS_CUMPLIMIENTO[estado]}: {valorDe(estado, cumplimiento)}
            </Link>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-marca-600/60 pt-3">
        {acciones}
        <span className="mx-1 hidden h-6 w-px bg-marca-600 md:block" aria-hidden="true" />
        <EnlaceIcono
          href={`/control/partes/exportar?formato=csv&${consultaExport}`}
          icono="descarga"
          etiqueta="Exportar CSV"
          variante="secundario"
          oscuro
          prefetch={false}
        />
        <EnlaceIcono
          href={`/control/partes/exportar?formato=xlsx&${consultaExport}`}
          icono="hoja"
          etiqueta="Exportar Excel"
          variante="secundario"
          oscuro
          prefetch={false}
        />
        <EnlaceIcono
          href={`/control/partes/exportar?formato=pdf&${consultaExport}`}
          icono="documento"
          etiqueta="Exportar PDF"
          variante="secundario"
          oscuro
          prefetch={false}
        />
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-marca-200 sm:flex">
          <Icono nombre="usuarios" className="h-3.5 w-3.5" />
          {cumplimiento.total} personas en tu ámbito
        </span>
      </div>
    </section>
  )
}
