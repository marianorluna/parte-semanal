'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BotonIcono } from '@/components/AccionesIcono'
import { recordarUsuariosAction } from '../acciones-lote'

/**
 * Recordatorio masivo desde el resumen del panel. Reutiliza la acción de
 * Equipo: el servicio ya limita a un aviso por persona y día.
 */
export function RecordarPendientes({
  usuarioIds,
  isoYear,
  isoWeek,
}: {
  usuarioIds: string[]
  isoYear: number
  isoWeek: number
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [resultado, setResultado] = useState<{ texto: string; error: boolean } | null>(null)

  if (usuarioIds.length === 0) return null

  const etiqueta = `Recordar a ${usuarioIds.length} ${usuarioIds.length === 1 ? 'persona' : 'personas'}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BotonIcono
        icono="campana"
        etiqueta={pendiente ? 'Enviando recordatorios' : etiqueta}
        etiquetaCorta="Recordar"
        variante="acento"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const respuesta = await recordarUsuariosAction({ usuarioIds, isoYear, isoWeek })
            setResultado(
              respuesta.ok
                ? { texto: respuesta.mensaje, error: false }
                : { texto: respuesta.error, error: true },
            )
            router.refresh()
          })
        }
      />
      {resultado ? (
        <span className={`text-xs ${resultado.error ? 'text-red-700' : 'text-acento-800'}`} role="status">
          {resultado.texto}
        </span>
      ) : null}
    </div>
  )
}
