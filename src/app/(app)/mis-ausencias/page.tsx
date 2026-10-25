import { requireUsuario, requiereEmpleado } from '@/modules/identidad/application/sesion'
import { depsAusencias } from '@/composition'
import {
  anioActual,
  listarMisAusencias,
  listarTipos,
  saldoDeEmpleado,
} from '@/modules/ausencias/application/servicio'
import { CLASES_ESTADO_AUSENCIA, ETIQUETAS_ESTADO_AUSENCIA } from '@/modules/ausencias/domain/ausencia'
import { formatearFecha, hoyEnZona } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { BotonAnular, FormularioSolicitud } from './FormulariosAusencia'
import { AvisoOrigenRrhh } from '@/components/AvisoOrigenRrhh'

export const dynamic = 'force-dynamic'

export default async function MisAusenciasPage() {
  const usuario = await requireUsuario()
  const empleadoId = requiereEmpleado(usuario)

  const [tipos, ausencias, saldo] = await Promise.all([
    listarTipos(depsAusencias, usuario),
    listarMisAusencias(depsAusencias, usuario),
    saldoDeEmpleado(depsAusencias, empleadoId, anioActual()),
  ])
  const tiposActivos = tipos.filter((tipo) => tipo.activo)
  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Mis ausencias</h1>
        <p className="text-sm text-slate-600">
          Solicita vacaciones, permisos o bajas. Un día aprobado de jornada completa queda bloqueado
          en tu rejilla con el motivo visible.
        </p>
      </div>

      <AvisoOrigenRrhh contexto="trabajador" />

      <div className="tarjeta p-4">
        <h2 className="text-sm font-semibold text-slate-900">Saldo de vacaciones {saldo.anio}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Asignado</dt>
            <dd className="font-mono text-slate-800">{formatearHorasReloj(saldo.asignados)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Arrastrado</dt>
            <dd className="font-mono text-slate-800">{formatearHorasReloj(saldo.arrastrados)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Consumido</dt>
            <dd className="font-mono text-slate-800">{formatearHorasReloj(saldo.consumidos)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Disponible</dt>
            <dd className="font-mono font-semibold text-slate-900">{formatearHorasReloj(saldo.restantes)}</dd>
          </div>
        </dl>
        {saldo.disponibles === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Administración todavía no ha configurado tu saldo anual. Puedes solicitar igualmente; el
            saldo se regulariza después.
          </p>
        ) : null}
      </div>

      <details className="tarjeta p-4">
        <summary className="cursor-pointer text-sm font-semibold text-marca-800">
          Registrar ausencia en LeviParte
        </summary>
        <div className="mt-4">
          <p className="mb-3 text-xs text-slate-600">
            La solicitud oficial se tramita en Bizneo. Este registro solo sirve para bloquear los días
            en tu rejilla mientras la sincronización no esté activa.
          </p>
          {tiposActivos.length === 0 ? (
            <p className="text-sm text-slate-600">
              No hay tipos de ausencia activos. Pide a administración que los configure.
            </p>
          ) : (
            <FormularioSolicitud
              tipos={tiposActivos.map((tipo) => ({ id: tipo.id, nombre: tipo.nombre }))}
              hoy={hoy}
            />
          )}
        </div>
      </details>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Mis solicitudes</h2>
        {ausencias.length === 0 ? (
          <p className="tarjeta p-4 text-sm text-slate-600">Todavía no has solicitado ausencias.</p>
        ) : (
          <ul className="space-y-3">
            {ausencias.map((ausencia) => (
              <li key={ausencia.id} className="tarjeta p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{ausencia.tipoNombre}</p>
                    <p className="text-xs text-slate-600">
                      {ausencia.desde === ausencia.hasta
                        ? formatearFecha(ausencia.desde)
                        : `${formatearFecha(ausencia.desde)} a ${formatearFecha(ausencia.hasta)}`}
                      {ausencia.minutos !== null
                        ? ` · ${formatearHorasReloj(ausencia.minutos)} por día`
                        : ' · Jornada completa'}
                    </p>
                    {ausencia.motivoSolicitud ? (
                      <p className="mt-1 text-xs text-slate-500">{ausencia.motivoSolicitud}</p>
                    ) : null}
                    {ausencia.motivoResolucion ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Resolución: {ausencia.motivoResolucion}
                      </p>
                    ) : null}
                  </div>
                  <span className={`etiqueta ${CLASES_ESTADO_AUSENCIA[ausencia.estado]}`}>
                    {ETIQUETAS_ESTADO_AUSENCIA[ausencia.estado]}
                  </span>
                </div>
                {ausencia.estado === 'SOLICITADA' || ausencia.estado === 'APROBADA' ? (
                  <BotonAnular ausenciaId={ausencia.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
