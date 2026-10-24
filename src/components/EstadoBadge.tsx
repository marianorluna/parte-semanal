import type { EstadoParte } from '@/db/schema'
import { etiquetaEstado } from '@/modules/partes/domain/parte'

const ESTILOS: Record<EstadoParte, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  ENVIADO: 'bg-amber-100 text-amber-800',
  APROBADO: 'bg-acento-100 text-acento-800',
  RECHAZADO: 'bg-red-100 text-red-800',
  BLOQUEADO: 'bg-marca-900 text-white',
}

export function EstadoBadge({ estado }: { estado: EstadoParte }) {
  return <span className={`etiqueta ${ESTILOS[estado]}`}>{etiquetaEstado(estado)}</span>
}
