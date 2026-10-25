import Link from 'next/link'
import { requireRol } from '@/modules/identidad/application/sesion'
import { proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { hoyEnZona } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import {
  CLASES_RIESGO,
  ETIQUETAS_RIESGO,
  type NivelRiesgo,
} from '@/modules/reporting/domain/riesgo'
import { panelRiesgo } from '@/modules/reporting/application/panel'
import { TablaRiesgo } from '@/components/TablaRiesgo'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ nivel?: string }>
}

const NIVELES: readonly NivelRiesgo[] = ['AGOTADO', 'CRITICO', 'AVISO', 'OK', 'SIN_PRESUPUESTO', 'SIN_PLAZO']

export default async function ProyectosPage({ searchParams }: Props) {
  const usuario = await requireRol('ENCARGADO', 'ADMIN')
  const params = await searchParams

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const permitidos = await proyectosPermitidos(usuario)
  const panel = await panelRiesgo(usuario.empresaId, permitidos, hoy)

  const nivel = NIVELES.find((candidato) => candidato === params.nivel)
  const filas = nivel ? panel.filas.filter((fila) => fila.riesgo.nivel === nivel) : panel.filas

  const conteo: Record<NivelRiesgo, number> = {
    AGOTADO: panel.resumen.agotados,
    CRITICO: panel.resumen.criticos,
    AVISO: panel.resumen.avisos,
    OK: panel.resumen.ok,
    SIN_PRESUPUESTO: 0,
    SIN_PLAZO: 0,
  }
  for (const fila of panel.filas) {
    if (fila.riesgo.nivel === 'SIN_PRESUPUESTO') conteo.SIN_PRESUPUESTO += 1
    if (fila.riesgo.nivel === 'SIN_PLAZO') conteo.SIN_PLAZO += 1
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Proyectos</h1>
          <p className="text-sm text-slate-600">
            Consumo acumulado frente a presupuesto y plazo. Solo cuentan partes enviados o aprobados.
          </p>
        </div>
        <Link href="/control/dashboard" className="boton-secundario px-3 py-1.5 text-xs">
          Volver al dashboard
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {NIVELES.map((candidato) => {
          const activo = nivel === candidato
          return (
            <Link
              key={candidato}
              href={activo ? '/control/proyectos' : `/control/proyectos?nivel=${candidato}`}
              aria-pressed={activo}
              className={`etiqueta ${CLASES_RIESGO[candidato]} ${activo ? 'ring-2 ring-marca-600 ring-offset-1' : ''}`}
            >
              {ETIQUETAS_RIESGO[candidato]}: {conteo[candidato]}
            </Link>
          )
        })}
      </div>

      <div className="tarjeta p-4">
        <TablaRiesgo filas={filas} />
      </div>

      {panel.ajuste ? (
        <div className="tarjeta p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Horas de ajuste
              <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-slate-600">
                Comodín
              </span>
            </h2>
            <span className="cifra text-sm font-semibold text-slate-900">
              {formatearHorasReloj(panel.ajuste.minutos)}
            </span>
          </div>
          <p className="text-sm text-slate-600">
            <Link href={`/control/proyectos/${panel.ajuste.proyectoId}`} className="font-medium hover:text-marca-700">
              {panel.ajuste.codigo} · {panel.ajuste.nombre}
            </Link>{' '}
            recoge las horas que no corresponden a un proyecto real. No tiene semáforo ni genera alertas,
            pero suma en el total de la empresa.
          </p>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        Los proyectos sin fechas o sin presupuesto aparecen como «sin datos»: informan consumo, pero no se les
        aplica el semáforo de desviación.
      </p>
    </section>
  )
}
