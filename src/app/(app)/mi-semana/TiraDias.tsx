import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import type { DiaSemana } from './RejillaSemanal'

/**
 * Tira de siete días con las horas ya imputadas. Se usa para elegir los días
 * que se rellenan y, después, para abrir el día concreto que se corrige a mano.
 */
export function TiraDias({
  dias,
  diaSeleccionado,
  totalDia,
  onSeleccionarDia,
}: {
  dias: DiaSemana[]
  diaSeleccionado: string
  totalDia: Record<string, number>
  onSeleccionarDia: (fecha: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1" role="group" aria-label="Días de la semana">
      {dias.map((dia) => {
        const activo = dia.fecha === diaSeleccionado
        const minutosDia = totalDia[dia.fecha] ?? 0
        return (
          <button
            key={dia.fecha}
            type="button"
            onClick={() => onSeleccionarDia(dia.fecha)}
            aria-pressed={activo}
            title={dia.motivo ?? undefined}
            className={`flex min-h-16 min-w-0 flex-col items-center justify-center rounded-md border px-0.5 py-1 transition-colors ${
              activo
                ? 'border-marca-700 bg-marca-700 text-white'
                : dia.esHoy
                  ? 'border-acento-400 bg-acento-50 text-marca-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            } ${dia.laborable ? '' : 'opacity-60'}`}
          >
            <span className="text-[11px] font-semibold capitalize">{dia.dia}</span>
            <span className={`cifra text-[11px] ${activo ? 'text-marca-100' : 'text-slate-500'}`}>
              {dia.fecha.slice(8, 10)}
            </span>
            <span
              className={`cifra text-[11px] font-bold ${
                minutosDia > 0
                  ? activo
                    ? 'text-white'
                    : 'text-marca-800'
                  : activo
                    ? 'text-marca-200'
                    : 'text-slate-300'
              }`}
            >
              {minutosDia > 0 ? formatearHorasReloj(minutosDia) : '·'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
