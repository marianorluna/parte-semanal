/**
 * Aviso sobre el origen de los datos de ausencias.
 *
 * La empresa gestiona vacaciones, permisos, bajas, fichaje y horas extra en
 * Bizneo. LeviParte solo necesita conocer las ausencias aprobadas para bloquear
 * los días de la rejilla, así que el aviso separa lo que es fuente de verdad
 * (Bizneo) de lo que hoy se registra en esta aplicación. Mientras la
 * sincronización no exista, el texto no debe prometer datos actualizados.
 */

export type ContextoAvisoRrhh = 'trabajador' | 'gestion'

const TEXTOS: Record<ContextoAvisoRrhh, string> = {
  trabajador:
    'Vacaciones, permisos y bajas se gestionan en Bizneo. La solicitud oficial se tramita allí; lo que registres aquí solo actualiza tu disponibilidad en LeviParte. La sincronización automática con Bizneo está prevista.',
  gestion:
    'Vacaciones, permisos y bajas se dan de alta y se aprueban en Bizneo. La sincronización automática está prevista; mientras no esté activa, confirma en Bizneo las ausencias antes de cerrar la semana.',
}

export function AvisoOrigenRrhh({ contexto }: { contexto: ContextoAvisoRrhh }) {
  return (
    <div role="note" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Origen de los datos: Bizneo</p>
      <p className="mt-1 text-xs leading-relaxed">{TEXTOS[contexto]}</p>
    </div>
  )
}
