import type { ReactNode } from 'react'
import type { EstadoParte } from '@/db/schema'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { EstadoBadge } from '@/components/EstadoBadge'

/**
 * Resumen de la semana compartido por los dos modos. El color del progreso y
 * de la desviación se decide en un solo sitio para que la lectura sea la misma
 * al cambiar de modo.
 */
export function ResumenSemana({
  isoWeek,
  isoYear,
  total,
  capacidadMin,
  porDefecto,
  desviacion,
  estado,
  guardando,
  mensaje,
  hayCambios,
  hayErrores,
  children,
}: {
  isoWeek: number
  isoYear: number
  total: number
  capacidadMin: number | null
  porDefecto: boolean
  desviacion: number | null
  estado: EstadoParte
  guardando: boolean
  mensaje: string
  hayCambios: boolean
  hayErrores: boolean
  children?: ReactNode
}) {
  const referencia = capacidadMin ?? 40 * 60
  const porcentaje = Math.min(100, Math.round((total / referencia) * 100))
  const enJornada = desviacion === 0 || capacidadMin === null

  const estadoGuardado = guardando
    ? 'Guardando...'
    : hayErrores
      ? 'Hay horas por corregir'
      : hayCambios
        ? 'Cambios sin guardar'
        : mensaje || 'Todo guardado'

  return (
    <section className="superficie-hero cifra p-4 sm:p-5" aria-label="Resumen de la semana">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-acento-300 uppercase">
            Semana {isoWeek} de {isoYear}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-4xl leading-none font-bold sm:text-5xl">{formatearHorasReloj(total)}</p>
            <p className="text-sm text-marca-100">
              {capacidadMin !== null ? `de ${formatearHorasReloj(capacidadMin)} teóricas` : 'registradas'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <EstadoBadge estado={estado} />
          <p
            aria-live="polite"
            className={`text-xs font-medium ${
              hayErrores
                ? 'text-red-200'
                : hayCambios || guardando
                  ? 'text-acento-200'
                  : 'text-marca-200'
            }`}
          >
            {estadoGuardado}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-marca-950/50">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            desviacion !== null && desviacion > 0
              ? 'bg-amber-400'
              : enJornada
                ? 'bg-acento-400'
                : 'bg-acento-500'
          }`}
          style={{ width: `${porcentaje}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-marca-200">
          {porDefecto
            ? 'Sin calendario laboral: se aplica lunes a viernes'
            : `${porcentaje}% de la jornada teórica`}
        </span>
        {desviacion !== null && desviacion !== 0 ? (
          <span className={`font-semibold ${desviacion > 0 ? 'text-amber-300' : 'text-acento-200'}`}>
            {desviacion > 0 ? '+' : '-'}
            {formatearHorasReloj(Math.abs(desviacion))} {desviacion > 0 ? 'por encima' : 'por debajo'}
          </span>
        ) : desviacion === 0 ? (
          <span className="font-semibold text-acento-200">En jornada</span>
        ) : null}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  )
}
