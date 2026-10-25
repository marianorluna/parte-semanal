import { Icono } from '@/components/Iconos'
import { CLASES_CUMPLIMIENTO } from '@/modules/reporting/domain/cumplimiento'
import { CLASES_RIESGO } from '@/modules/reporting/domain/riesgo'
import {
  INDICADORES,
  ITEMS_ESTADO,
  ITEMS_RIESGO,
  ITEMS_SEMAFORO,
  NOTA_BLOQUEADO,
  NOTA_NEUTRO,
  NOTA_RIESGO_CABECERA,
} from './leyenda'
import { TILE } from './semaforo'

/**
 * Leyenda de los tres vocabularios de color que conviven en el dashboard:
 * semáforo de los indicadores, riesgo de proyecto y estado del parte.
 *
 * Componente de servidor sin props: el contenido es estático y se deriva de los
 * `ETIQUETAS_*` y `CLASES_*` del dominio, no de los datos de la semana.
 */
export function LeyendaDashboard() {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Qué mide cada tarjeta
        </h3>
        <dl className="mt-1.5 space-y-1.5">
          {INDICADORES.map((indicador) => (
            <div key={indicador.etiqueta} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="text-xs font-semibold text-slate-900 sm:w-32 sm:shrink-0">
                {indicador.etiqueta}
              </dt>
              <dd className="min-w-0 text-xs leading-snug text-slate-600">
                {indicador.descripcion}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Semáforo de los indicadores
        </h3>
        {/* Sobre el petróleo de la marca, que es el fondo real de las tarjetas. */}
        <div className="mt-1.5 space-y-1.5 rounded-lg bg-marca-900 p-2">
          {ITEMS_SEMAFORO.map((item) => (
            <div
              key={item.clave}
              className={`flex items-center gap-2 rounded-md border p-1.5 ${TILE[item.clave].caja}`}
            >
              <span className={`etiqueta shrink-0 ${TILE[item.clave].pastilla}`}>{item.etiqueta}</span>
              <span className="min-w-0 text-[11px] leading-tight text-marca-100">
                {item.descripcion}
              </span>
            </div>
          ))}
          <p className="flex items-start gap-1.5 px-1 pt-0.5 text-[11px] leading-tight text-marca-200">
            <Icono nombre="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{NOTA_NEUTRO}</span>
          </p>
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Riesgo de proyecto
        </h3>
        <ul className="mt-1.5 space-y-1.5">
          {ITEMS_RIESGO.map((item) => (
            <li key={item.clave} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <span className={`etiqueta self-start sm:w-40 sm:shrink-0 ${CLASES_RIESGO[item.clave]}`}>
                {item.etiqueta}
              </span>
              <span className="min-w-0 text-xs leading-snug text-slate-600">{item.descripcion}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{NOTA_RIESGO_CABECERA}</p>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Estado del parte
        </h3>
        <ul className="mt-1.5 space-y-1.5">
          {ITEMS_ESTADO.map((item) => (
            <li key={item.clave} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <span
                className={`etiqueta self-start sm:w-40 sm:shrink-0 ${CLASES_CUMPLIMIENTO[item.clave]}`}
              >
                {item.etiqueta}
              </span>
              <span className="min-w-0 text-xs leading-snug text-slate-600">{item.descripcion}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{NOTA_BLOQUEADO}</p>
      </section>
    </div>
  )
}
