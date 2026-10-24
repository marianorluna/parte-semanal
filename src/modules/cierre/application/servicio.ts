import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import type { FechaIso } from '@/modules/partes/domain/fechas'
import { AppError } from '@/shared/errors'
import {
  etiquetaPeriodo,
  fechasCubiertas,
  haySolape,
  motivoValido,
  resolverPeriodo,
  type EntradaCierre,
  type Periodo,
} from '../domain/cierre'
import type { PeriodoCerradoListado, RepositorioCierre } from './ports'

export type DepsCierre = {
  repo: RepositorioCierre
  /**
   * Recalcula los agregados (cómputo y coste) de un parte que vuelve a
   * APROBADO al reabrir su periodo. Si falla, la reapertura se mantiene.
   */
  recalcular?: (parteId: string, usuario: UsuarioSesion) => Promise<void>
}

function exigirAdmin(usuario: UsuarioSesion): void {
  if (usuario.rol !== 'ADMIN') {
    throw new AppError('SIN_PERMISO', 'Solo un administrador puede cerrar o reabrir periodos')
  }
}

export function listarPeriodos(
  deps: DepsCierre,
  usuario: UsuarioSesion,
): Promise<PeriodoCerradoListado[]> {
  return deps.repo.listar(usuario.empresaId)
}

function resolver(usuario: UsuarioSesion, entrada: EntradaCierre): Periodo {
  const resultado = resolverPeriodo(entrada, usuario.empresaId)
  if (!resultado.ok) {
    throw new AppError('VALIDACION', resultado.mensaje, { [resultado.campo]: resultado.mensaje })
  }
  return resultado.periodo
}

/**
 * Cierra un periodo y bloquea sus partes aprobados. Un cierre repetido del
 * mismo ámbito y rango se rechaza: primero hay que reabrir el anterior.
 */
export async function cerrarPeriodo(
  deps: DepsCierre,
  usuario: UsuarioSesion,
  entrada: EntradaCierre,
  motivo: string | null = null,
): Promise<{ id: string; partesBloqueados: number; etiqueta: string }> {
  exigirAdmin(usuario)
  const periodo = resolver(usuario, entrada)

  if (periodo.empleadoId) {
    const pertenece = await deps.repo.empleadoPerteneceAEmpresa(periodo.empleadoId, usuario.empresaId)
    if (!pertenece) throw new AppError('NO_ENCONTRADO', 'El empleado no existe')
  }

  const solape = haySolape(
    await deps.repo.solapesActivos({
      ...periodo,
      motivo: null,
    }),
    periodo,
  )
  if (solape) {
    throw new AppError(
      'VALIDACION',
      `Ya hay un periodo cerrado que cubre estas fechas (${solape.desde} a ${solape.hasta}). Reábrelo antes de volver a cerrar.`,
      { periodo: 'Periodo ya cerrado' },
    )
  }

  const resultado = await deps.repo.cerrar(
    { ...periodo, motivo: motivo?.trim() || null },
    usuario.id,
  )

  return { ...resultado, etiqueta: etiquetaPeriodo(periodo) }
}

/**
 * Reabre un periodo con motivo y devuelve a APROBADO los partes que ya no
 * estén cubiertos por otro cierre. Los agregados se recalculan después: si el
 * recálculo falla, la reapertura sigue siendo válida.
 */
export async function reabrirPeriodo(
  deps: DepsCierre,
  usuario: UsuarioSesion,
  periodoId: string,
  motivo: string,
): Promise<{ partesDesbloqueados: number; recalculados: number }> {
  exigirAdmin(usuario)

  const errorMotivo = motivoValido(motivo)
  if (errorMotivo) throw new AppError('VALIDACION', errorMotivo, { motivo: errorMotivo })

  const periodo = await deps.repo.obtener(periodoId, usuario.empresaId)
  if (!periodo) throw new AppError('NO_ENCONTRADO', 'El periodo no existe')
  if (!periodo.activo) throw new AppError('ESTADO_INVALIDO', 'El periodo ya está reabierto')

  const { partesDesbloqueados } = await deps.repo.reabrir(
    periodoId,
    usuario.empresaId,
    usuario.id,
    motivo.trim(),
  )

  let recalculados = 0
  if (deps.recalcular) {
    for (const parteId of partesDesbloqueados) {
      try {
        await deps.recalcular(parteId, usuario)
        recalculados += 1
      } catch (error) {
        console.error('[cierre] no se pudieron recalcular los agregados', parteId, error)
      }
    }
  }

  return { partesDesbloqueados: partesDesbloqueados.length, recalculados }
}

/**
 * Fechas cerradas que afectan a un empleado. Es el guardián que consulta el
 * módulo de partes antes de cualquier escritura.
 */
export async function fechasBloqueadas(
  deps: DepsCierre,
  empresaId: string,
  empleadoId: string,
  desde: FechaIso,
  hasta: FechaIso,
): Promise<FechaIso[]> {
  const periodos = await deps.repo.periodosActivos(empresaId, empleadoId)
  return fechasCubiertas(periodos, desde, hasta)
}

export function mensajePeriodoCerrado(fechas: readonly FechaIso[]): string {
  const primera = fechas[0]
  return primera
    ? `El periodo está cerrado (desde ${primera}). Reábrelo en Administración > Cierres para poder editar.`
    : 'El periodo está cerrado'
}
