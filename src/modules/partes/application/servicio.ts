import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import { AppError } from '@/shared/errors'
import {
  type FechaIso,
  type SemanaIso,
  diasDeSemana,
  hoyEnZona,
  semanaIso,
  semanaIsoDe,
  sumarDias,
} from '../domain/fechas'
import { type ImputacionEntrada, validarParte } from '../domain/parte'
import { puedeRevisarParte } from '../domain/permisos'
import { agruparTareas, type GrupoProyecto } from './agrupacion'
import type { CalendarioSemana, ParteCompleto, RepositorioPartes } from './ports'

export type DepsPartes = {
  repo: RepositorioPartes
  proyectosPermitidos: (usuario: UsuarioSesion) => Promise<string[] | null>
  proyectosDeParte: (parteId: string) => Promise<string[]>
  /** Calendario laboral resuelto de la semana; sin calendario, lunes-viernes. */
  calendario: {
    semana: (empleadoId: string, semana: SemanaIso) => Promise<CalendarioSemana>
  }
  /**
   * Efectos posteriores a la aprobación (cómputo, coste, outbox). Se ejecutan
   * fuera de la transacción del estado: si fallan, la aprobación se mantiene y
   * el administrador puede recalcular.
   */
  alAprobar?: (parteId: string, usuario: UsuarioSesion) => Promise<void>
  /**
   * Efectos de la reapertura: retirar snapshots de cómputo y coste para que no
   * cuenten como cerrados mientras el parte vuelve a edición.
   */
  alReabrir?: (parteId: string, usuario: UsuarioSesion) => Promise<void>
  /**
   * Fechas cerradas del empleado. La UI deshabilita, pero el servidor vuelve a
   * comprobarlo: un periodo cerrado no admite escritura ni para administración.
   */
  cierre?: {
    fechasBloqueadas: (
      empresaId: string,
      empleadoId: string,
      desde: FechaIso,
      hasta: FechaIso,
    ) => Promise<FechaIso[]>
  }
  ahora?: () => Date
}

export type VistaSemana = {
  semana: SemanaIso
  parte: ParteCompleto
  grupos: GrupoProyecto[]
  calendario: CalendarioSemana
}

function semanaDesde(isoYear?: number, isoWeek?: number): SemanaIso {
  if (isoYear && isoWeek) {
    try {
      return semanaIso(isoYear, isoWeek)
    } catch {
      throw new AppError('VALIDACION', 'La semana indicada no es válida')
    }
  }

  const zona = process.env.TZ ?? 'Europe/Madrid'
  return semanaIsoDe(hoyEnZona(zona))
}

function exigirEmpleado(usuario: UsuarioSesion): string {
  if (!usuario.empleadoId) {
    throw new AppError(
      'SIN_PERMISO',
      'Tu usuario no está vinculado a un empleado. Pide a administración que lo configure.',
    )
  }
  return usuario.empleadoId
}

async function exigirAlcanceSobreParte(
  deps: DepsPartes,
  usuario: UsuarioSesion,
  parteId: string,
): Promise<ParteCompleto> {
  if (usuario.rol !== 'ENCARGADO' && usuario.rol !== 'ADMIN') {
    throw new AppError('SIN_PERMISO', 'No tienes permiso para revisar partes')
  }

  const parte = await deps.repo.obtenerDetalle(parteId)
  if (!parte) throw new AppError('NO_ENCONTRADO', 'El parte no existe')

  // El encargado no revisa sus propias horas ni las de otro encargado o admin.
  const rolEmpleado = await deps.repo.rolDeEmpleado(parte.empleadoId)
  if (!puedeRevisarParte(usuario.rol, rolEmpleado)) {
    throw new AppError('SIN_PERMISO', 'Solo el administrador puede revisar este parte')
  }

  if (usuario.rol === 'ADMIN') return parte

  const permitidos = await deps.proyectosPermitidos(usuario)
  if (permitidos === null) return parte

  const delParte = await deps.proyectosDeParte(parteId)
  const autorizado = delParte.some((proyectoId) => permitidos.includes(proyectoId))
  if (!autorizado) {
    throw new AppError('NO_ENCONTRADO', 'El parte no existe o no está en tu ámbito')
  }

  return parte
}

/**
 * Un periodo cerrado no admite escritura: se comprueba antes de guardar,
 * enviar o revisar. La única salida es reabrirlo con motivo y auditoría.
 */
async function fechasCerradasDeSemana(
  deps: DepsPartes,
  empresaId: string,
  empleadoId: string,
  desde: FechaIso,
  hasta: FechaIso,
): Promise<FechaIso[]> {
  if (!deps.cierre) return []
  return deps.cierre.fechasBloqueadas(empresaId, empleadoId, desde, hasta)
}

function exigirPeriodoAbierto(fechas: readonly FechaIso[]): void {
  if (fechas.length === 0) return
  const primera = fechas[0]
  const ultima = fechas[fechas.length - 1]
  const rango = primera === ultima ? primera : `${primera} a ${ultima}`
  throw new AppError(
    'ESTADO_INVALIDO',
    `El periodo está cerrado (${rango}). Reábrelo en Administración > Cierres antes de modificar horas.`,
  )
}

export async function obtenerSemana(
  deps: DepsPartes,
  usuario: UsuarioSesion,
  isoYear?: number,
  isoWeek?: number,
): Promise<VistaSemana> {
  const empleadoId = exigirEmpleado(usuario)
  const semana = semanaDesde(isoYear, isoWeek)

  const existente = await deps.repo.buscarPorSemana(empleadoId, semana.isoYear, semana.isoWeek)
  const parte = existente ?? (await deps.repo.crearBorrador(usuario.empresaId, empleadoId, semana))

  const [asignadas, calendario] = await Promise.all([
    deps.repo.tareasAsignadas(empleadoId, semana.weekStart, semana.weekEnd),
    deps.calendario.semana(empleadoId, semana),
  ])

  const idsImputados = [...new Set(parte.imputaciones.map((i) => i.tareaId))]
  const yaIncluidas = new Set(asignadas.map((t) => t.tareaId))
  const faltantes = idsImputados.filter((id) => !yaIncluidas.has(id))
  const extra = faltantes.length > 0 ? await deps.repo.tareasPorIds(faltantes) : []

  return {
    semana,
    parte,
    grupos: agruparTareas([...asignadas, ...extra]),
    calendario,
  }
}

export type GuardarSemanaInput = {
  isoYear: number
  isoWeek: number
  version: number
  filas: ImputacionEntrada[]
}

export async function guardarSemana(
  deps: DepsPartes,
  usuario: UsuarioSesion,
  input: GuardarSemanaInput,
): Promise<number> {
  const empleadoId = exigirEmpleado(usuario)
  const semana = semanaDesde(input.isoYear, input.isoWeek)

  const parte = await deps.repo.buscarPorSemana(empleadoId, semana.isoYear, semana.isoWeek)
  if (!parte) throw new AppError('NO_ENCONTRADO', 'El parte no existe')

  const cerradas = await fechasCerradasDeSemana(deps, usuario.empresaId, empleadoId, semana.weekStart, semana.weekEnd)
  if (cerradas.length > 0) {
    const fieldErrors: Record<string, string> = {}
    for (const fecha of cerradas) fieldErrors[fecha] = 'Periodo cerrado'
    throw new AppError(
      'ESTADO_INVALIDO',
      `El periodo está cerrado (${cerradas[0]} a ${cerradas[cerradas.length - 1]}). Reábrelo en Administración > Cierres antes de modificar horas.`,
      fieldErrors,
    )
  }

  const asignadas = await deps.repo.tareasAsignadas(empleadoId, semana.weekStart, semana.weekEnd)
  const permitidas = new Set([
    ...asignadas.map((t) => t.tareaId),
    ...parte.imputaciones.map((i) => i.tareaId),
  ])

  const intrusa = input.filas.find((fila) => !permitidas.has(fila.tareaId))
  if (intrusa) {
    throw new AppError('SIN_PERMISO', 'Hay una tarea que no está asignada a este empleado')
  }

  const validacion = validarParte(semana.weekStart, input.filas, {
    permitirVacio: true,
    diasNoLaborables: (await deps.calendario.semana(empleadoId, semana)).dias
      .filter((dia) => !dia.laborable)
      .map((dia) => dia.fecha),
    fechasConHorasPrevias: parte.imputaciones.map((imputacion) => imputacion.fecha),
  })
  if (!validacion.ok) {
    const fieldErrors: Record<string, string> = {}
    for (const error of validacion.errores) {
      fieldErrors[`${error.fecha}|${error.tareaId}`] = error.mensaje
    }
    throw new AppError('VALIDACION', 'Revisa las horas introducidas', fieldErrors)
  }

  await deps.repo.guardarBorrador(parte.id, input.version, input.filas)
  return input.version + 1
}

export async function enviarSemana(
  deps: DepsPartes,
  usuario: UsuarioSesion,
  input: { isoYear: number; isoWeek: number; version: number },
): Promise<void> {
  const empleadoId = exigirEmpleado(usuario)
  const parte = await deps.repo.buscarPorSemana(empleadoId, input.isoYear, input.isoWeek)
  if (!parte) throw new AppError('NO_ENCONTRADO', 'El parte no existe')
  if (parte.totalMinutos <= 0) throw new AppError('VALIDACION', 'El parte no tiene horas que enviar')

  const semana = semanaIso(input.isoYear, input.isoWeek)
  exigirPeriodoAbierto(
    await fechasCerradasDeSemana(deps, usuario.empresaId, empleadoId, semana.weekStart, semana.weekEnd),
  )

  const calendario = await deps.calendario.semana(empleadoId, semana)

  await deps.repo.enviar(parte.id, input.version, usuario.id, {
    id: calendario.calendarioId,
    version: calendario.calendarioVersion,
  })
}

export async function aprobarSemana(
  deps: DepsPartes,
  usuario: UsuarioSesion,
  input: { parteId: string; version: number },
): Promise<void> {
  const parte = await exigirAlcanceSobreParte(deps, usuario, input.parteId)
  exigirPeriodoAbierto(
    await fechasCerradasDeSemana(deps, usuario.empresaId, parte.empleadoId, parte.weekStart, sumarDias(parte.weekStart, 6)),
  )
  await deps.repo.aprobar(input.parteId, input.version, usuario.id)

  if (deps.alAprobar) {
    try {
      await deps.alAprobar(input.parteId, usuario)
    } catch (error) {
      // La aprobación ya está confirmada; el snapshot se puede recalcular.
      console.error('[aprobacion] no se pudieron calcular los efectos posteriores', error)
    }
  }
}

export async function rechazarSemana(
  deps: DepsPartes,
  usuario: UsuarioSesion,
  input: { parteId: string; version: number; motivo: string },
): Promise<void> {
  const motivo = input.motivo.trim()
  if (motivo.length < 5) {
    throw new AppError('VALIDACION', 'El motivo del rechazo debe tener al menos 5 caracteres', {
      motivo: 'Escribe el motivo del rechazo',
    })
  }

  const parte = await exigirAlcanceSobreParte(deps, usuario, input.parteId)
  exigirPeriodoAbierto(
    await fechasCerradasDeSemana(deps, usuario.empresaId, parte.empleadoId, parte.weekStart, sumarDias(parte.weekStart, 6)),
  )
  await deps.repo.rechazar(input.parteId, input.version, usuario.id, motivo)
}

export async function reabrirSemana(
  deps: DepsPartes,
  usuario: UsuarioSesion,
  input: { parteId: string; version: number; motivo: string },
): Promise<void> {
  const motivo = input.motivo.trim()
  if (motivo.length < 5) {
    throw new AppError('VALIDACION', 'El motivo de la reapertura debe tener al menos 5 caracteres', {
      motivo: 'Escribe el motivo',
    })
  }

  const parte = await exigirAlcanceSobreParte(deps, usuario, input.parteId)
  exigirPeriodoAbierto(
    await fechasCerradasDeSemana(deps, usuario.empresaId, parte.empleadoId, parte.weekStart, sumarDias(parte.weekStart, 6)),
  )
  await deps.repo.reabrir(input.parteId, input.version, usuario.id, motivo)

  if (deps.alReabrir) {
    try {
      await deps.alReabrir(input.parteId, usuario)
    } catch (error) {
      // La reapertura ya está confirmada; el administrador puede recalcular.
      console.error('[reapertura] no se pudieron limpiar los agregados', error)
    }
  }
}

export function diasDeLaSemana(semana: SemanaIso): FechaIso[] {
  return diasDeSemana(semana.isoYear, semana.isoWeek)
}
