'use client'

import { useActionState } from 'react'
import type { TipoNotificacion } from '@/db/schema'
import { guardarPreferenciasAction, type EstadoPreferencias } from './actions'

const inicial: EstadoPreferencias = {}

const ETIQUETAS: Record<TipoNotificacion, { titulo: string; detalle: string }> = {
  RECORDATORIO_PARTE: {
    titulo: 'Recordatorios de horas',
    detalle: 'Avisos de viernes y lunes para completar o enviar el parte de la semana.',
  },
  EQUIPO_PENDIENTE: {
    titulo: 'Partes del equipo',
    detalle: 'Digest de partes pendientes de revisar. Solo afecta a encargados y administración.',
  },
  RIESGO_PROYECTO: {
    titulo: 'Riesgo de proyecto',
    detalle: 'Desviaciones relevantes de horas o presupuesto en los proyectos que gestionas.',
  },
}

const ORDEN: readonly TipoNotificacion[] = [
  'RECORDATORIO_PARTE',
  'EQUIPO_PENDIENTE',
  'RIESGO_PROYECTO',
]

type Preferencia = { tipo: TipoNotificacion; email: boolean; inApp: boolean }

export function FormularioPreferencias({
  preferencias,
  proveedorConfigurado,
}: {
  preferencias: readonly Preferencia[]
  proveedorConfigurado: boolean
}) {
  const [estado, accion, pendiente] = useActionState(guardarPreferenciasAction, inicial)

  const porTipo = new Map(preferencias.map((fila) => [fila.tipo, fila]))
  const activa = (tipo: TipoNotificacion, canal: 'email' | 'inApp'): boolean =>
    porTipo.get(tipo)?.[canal] ?? true

  return (
    <form action={accion} className="space-y-4">
      {!proveedorConfigurado ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          El envío de correo no está configurado en este entorno. Las preferencias se guardan igual y se
          aplicarán cuando se defina SMTP_URL.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Aviso</th>
              <th className="px-4 py-2 text-center font-medium">En la app</th>
              <th className="px-4 py-2 text-center font-medium">Por correo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ORDEN.map((tipo) => (
              <tr key={tipo}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{ETIQUETAS[tipo].titulo}</p>
                  <p className="text-xs text-slate-500">{ETIQUETAS[tipo].detalle}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    name={`inApp_${tipo}`}
                    defaultChecked={activa(tipo, 'inApp')}
                    aria-label={`${ETIQUETAS[tipo].titulo} en la app`}
                    className="h-4 w-4 accent-marca-700"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    name={`email_${tipo}`}
                    defaultChecked={activa(tipo, 'email')}
                    aria-label={`${ETIQUETAS[tipo].titulo} por correo`}
                    className="h-4 w-4 accent-marca-700"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Si desactivas un aviso, deja de generarse en ese canal. Los avisos ya enviados no se borran.
      </p>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pendiente} className="boton-primario">
          {pendiente ? 'Guardando...' : 'Guardar preferencias'}
        </button>
        {estado.error ? (
          <p role="alert" className="text-sm text-red-700">
            {estado.error}
          </p>
        ) : null}
        {estado.ok ? (
          <p role="status" className="text-sm text-acento-800">
            {estado.ok}
          </p>
        ) : null}
      </div>
    </form>
  )
}
