import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import { esFechaIso, hoyEnZona, type FechaIso } from '@/modules/partes/domain/fechas'
import { AppError } from '@/shared/errors'
import {
  calcularSaldo,
  consumoPorAnio,
  type AusenciaVigente,
  type CapacidadDia,
  type EstadoAusencia,
  transicionValida,
} from '../domain/ausencia'
import type {
  AusenciaListada,
  DatosSolicitud,
  DatosTipoAusencia,
  RepositorioAusencias,
  SaldoGuardado,
  TipoAusenciaResumen,
} from './ports'

export type DepsAusencias = {
  repo: RepositorioAusencias
  /**
   * Capacidad laboral del empleado por fecha, para repartir el consumo de las
   * ausencias de jornada completa. Se resuelve con el calendario del empleado.
   */
  capacidad: (
    empleadoId: string,
    desde: FechaIso,
    hasta: FechaIso,
  ) => Promise<Record<FechaIso, CapacidadDia>>
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

function validarTipo(datos: DatosTipoAusencia): DatosTipoAusencia {
  const codigo = datos.codigo.trim().toUpperCase()
  const nombre = datos.nombre.trim()

  if (codigo.length < 2) {
    throw new AppError('VALIDACION', 'El código es obligatorio', { codigo: 'Mínimo 2 caracteres' })
  }
  if (nombre.length < 3) {
    throw new AppError('VALIDACION', 'El nombre es obligatorio', { nombre: 'Mínimo 3 caracteres' })
  }

  return { ...datos, codigo, nombre }
}

export function listarTipos(deps: DepsAusencias, usuario: UsuarioSesion): Promise<TipoAusenciaResumen[]> {
  return deps.repo.listarTipos(usuario.empresaId)
}

export async function crearTipo(
  deps: DepsAusencias,
  usuario: UsuarioSesion,
  datos: DatosTipoAusencia,
): Promise<string> {
  return deps.repo.crearTipo(usuario.empresaId, validarTipo(datos))
}

export async function actualizarTipo(
  deps: DepsAusencias,
  usuario: UsuarioSesion,
  tipoId: string,
  datos: DatosTipoAusencia,
): Promise<void> {
  const tipo = await deps.repo.obtenerTipo(tipoId)
  if (!tipo || tipo.empresaId !== usuario.empresaId) {
    throw new AppError('NO_ENCONTRADO', 'El tipo de ausencia no existe')
  }
  await deps.repo.actualizarTipo(tipoId, validarTipo(datos))
}

export async function alternarTipo(
  deps: DepsAusencias,
  usuario: UsuarioSesion,
  tipoId: string,
  activo: boolean,
): Promise<void> {
  const tipo = await deps.repo.obtenerTipo(tipoId)
  if (!tipo || tipo.empresaId !== usuario.empresaId) {
    throw new AppError('NO_ENCONTRADO', 'El tipo de ausencia no existe')
  }
  await deps.repo.alternarTipo(tipoId, activo)
}

export type EntradaSolicitud = {
  tipoId: string
  desde: string
  hasta: string
  minutos: number | null
  motivo: string | null
}

function validarSolicitud(datos: EntradaSolicitud): DatosSolicitud {
  if (!esFechaIso(datos.desde) || !esFechaIso(datos.hasta)) {
    throw new AppError('VALIDACION', 'Las fechas de la ausencia no son válidas', {
      desde: 'Fecha inválida',
    })
  }
  if (datos.desde > datos.hasta) {
    throw new AppError('VALIDACION', 'La fecha final no puede ser anterior a la inicial', {
      hasta: 'Rango invertido',
    })
  }
  if (datos.minutos !== null && (!Number.isInteger(datos.minutos) || datos.minutos <= 0 || datos.minutos > 1440)) {
    throw new AppError('VALIDACION', 'Los minutos deben estar entre 1 y 1440', {
      minutos: 'Fuera de rango',
    })
  }

  const motivo = datos.motivo?.trim() ?? ''
  return {
    tipoId: datos.tipoId,
    desde: datos.desde,
    hasta: datos.hasta,
    minutos: datos.minutos,
    motivo: motivo.length > 0 ? motivo : null,
  }
}

export async function solicitarAusencia(
  deps: DepsAusencias,
  usuario: UsuarioSesion,
  datos: EntradaSolicitud,
): Promise<string> {
  const empleadoId = exigirEmpleado(usuario)
  const tipo = await deps.repo.obtenerTipo(datos.tipoId)
  if (!tipo || tipo.empresaId !== usuario.empresaId || !tipo.activo) {
    throw new AppError('VALIDACION', 'El tipo de ausencia no está disponible', {
      tipoId: 'Tipo no válido',
    })
  }

  return deps.repo.crear(usuario.empresaId, empleadoId, validarSolicitud(datos))
}

export async function resolverAusencia(
  deps: DepsAusencias,
  usuario: UsuarioSesion,
  input: { ausenciaId: string; decision: 'APROBADA' | 'RECHAZADA'; motivo: string },
): Promise<void> {
  if (usuario.rol !== 'ADMIN' && usuario.rol !== 'ENCARGADO') {
    throw new AppError('SIN_PERMISO', 'No tienes permiso para resolver ausencias')
  }

  const ausencia = await deps.repo.obtener(input.ausenciaId)
  if (!ausencia || ausencia.empresaId !== usuario.empresaId) {
    throw new AppError('NO_ENCONTRADO', 'La ausencia no existe')
  }
  if (ausencia.empleadoId === usuario.empleadoId) {
    throw new AppError('SIN_PERMISO', 'No puedes resolver tu propia ausencia')
  }

  const motivo = input.motivo.trim()
  if (input.decision === 'RECHAZADA' && motivo.length < 5) {
    throw new AppError('VALIDACION', 'Explica el motivo del rechazo', {
      motivo: 'Mínimo 5 caracteres',
    })
  }
  if (!transicionValida(ausencia.estado, input.decision)) {
    throw new AppError('ESTADO_INVALIDO', 'La ausencia ya está resuelta')
  }

  await deps.repo.cambiarEstado(
    ausencia.id,
    ausencia.estado,
    input.decision,
    usuario.id,
    motivo.length > 0 ? motivo : 'Aprobada',
  )
}

export async function anularAusencia(
  deps: DepsAusencias,
  usuario: UsuarioSesion,
  input: { ausenciaId: string; motivo: string },
): Promise<void> {
  const ausencia = await deps.repo.obtener(input.ausenciaId)
  if (!ausencia || ausencia.empresaId !== usuario.empresaId) {
    throw new AppError('NO_ENCONTRADO', 'La ausencia no existe')
  }
  if (ausencia.empleadoId !== usuario.empleadoId && usuario.rol !== 'ADMIN') {
    throw new AppError('SIN_PERMISO', 'Solo puedes anular tus propias ausencias')
  }
  if (!transicionValida(ausencia.estado, 'ANULADA')) {
    throw new AppError('ESTADO_INVALIDO', 'Esta ausencia ya no se puede anular')
  }

  const motivo = input.motivo.trim()
  if (motivo.length < 5) {
    throw new AppError('VALIDACION', 'Explica el motivo de la anulación', {
      motivo: 'Mínimo 5 caracteres',
    })
  }

  await deps.repo.cambiarEstado(ausencia.id, ausencia.estado, 'ANULADA', usuario.id, motivo)
}

export function listarMisAusencias(deps: DepsAusencias, usuario: UsuarioSesion): Promise<AusenciaListada[]> {
  return deps.repo.listar({
    empresaId: usuario.empresaId,
    empleadoId: exigirEmpleado(usuario),
  })
}

export function listarPendientes(
  deps: DepsAusencias,
  usuario: UsuarioSesion,
): Promise<AusenciaListada[]> {
  if (usuario.rol !== 'ADMIN' && usuario.rol !== 'ENCARGADO') {
    throw new AppError('SIN_PERMISO', 'No tienes permiso para ver ausencias del equipo')
  }

  return deps.repo.listar({
    empresaId: usuario.empresaId,
    estado: 'SOLICITADA',
    soloTrabajadores: usuario.rol === 'ENCARGADO',
  })
}

export function listarTodas(deps: DepsAusencias, usuario: UsuarioSesion): Promise<AusenciaListada[]> {
  return deps.repo.listar({ empresaId: usuario.empresaId })
}

/** Ausencias aprobadas que afectan a una semana: alimentan la rejilla. */
export async function ausenciasDeSemana(
  deps: DepsAusencias,
  empleadoId: string,
  weekStart: string,
  weekEnd: string,
): Promise<AusenciaVigente[]> {
  return deps.repo.aprobadasEnRango(empleadoId, weekStart, weekEnd)
}

/**
 * Ausencias aprobadas de un conjunto de empleados en un rango, agrupadas por
 * empleado. Lo usan las vistas de equipo para saber con quién se cuenta cada
 * semana. Los identificadores llegan ya acotados por quien consulta.
 */
export async function ausenciasDeSemanaDeEmpleados(
  deps: DepsAusencias,
  empleadoIds: string[],
  desde: string,
  hasta: string,
): Promise<Map<string, AusenciaVigente[]>> {
  const porEmpleado = new Map<string, AusenciaVigente[]>()
  if (empleadoIds.length === 0) return porEmpleado

  const ausencias = await deps.repo.aprobadasDeEmpleados(empleadoIds, desde, hasta)
  for (const ausencia of ausencias) {
    const lista = porEmpleado.get(ausencia.empleadoId) ?? []
    lista.push(ausencia)
    porEmpleado.set(ausencia.empleadoId, lista)
  }
  return porEmpleado
}

export function listarSaldos(
  deps: DepsAusencias,
  usuario: UsuarioSesion,
  empleadoId?: string,
): Promise<SaldoGuardado[]> {
  return deps.repo.listarSaldos(usuario.empresaId, empleadoId)
}

export async function guardarSaldo(
  deps: DepsAusencias,
  usuario: UsuarioSesion,
  datos: { empleadoId: string; anio: number; minutosAsignados: number; minutosArrastrados: number },
): Promise<void> {
  if (datos.minutosAsignados < 0 || datos.minutosArrastrados < 0) {
    throw new AppError('VALIDACION', 'El saldo no puede ser negativo', {
      minutosAsignados: 'Valor no válido',
    })
  }
  if (!Number.isInteger(datos.anio) || datos.anio < 2000 || datos.anio > 2100) {
    throw new AppError('VALIDACION', 'El año del saldo no es válido', { anio: 'Fuera de rango' })
  }

  const pertenece = await deps.repo.perteneceAEmpresa(datos.empleadoId, usuario.empresaId)
  if (!pertenece) {
    throw new AppError('NO_ENCONTRADO', 'El empleado no existe')
  }

  await deps.repo.guardarSaldo(
    datos.empleadoId,
    datos.anio,
    datos.minutosAsignados,
    datos.minutosArrastrados,
  )
}

export type SaldoCalculado = {
  empleadoId: string
  anio: number
  asignados: number
  arrastrados: number
  disponibles: number
  consumidos: number
  restantes: number
}

/**
 * Saldo real de un empleado: lo asignado más el arrastre menos el consumo de
 * las ausencias aprobadas que computan saldo, repartido por año natural.
 */
export async function saldoDeEmpleado(
  deps: DepsAusencias,
  empleadoId: string,
  anio: number,
): Promise<SaldoCalculado> {
  const [saldos, ausencias] = await Promise.all([
    deps.repo.listarSaldos(null, empleadoId),
    deps.repo.aprobadasDeEmpleado(empleadoId),
  ])

  // `listarSaldos('')` no filtra por empresa: el empleado ya viene acotado.
  const saldo = saldos.find((fila) => fila.anio === anio)
  const computables = ausencias.filter((ausencia) => ausencia.computaSaldo)

  let capacidad: Record<string, CapacidadDia> = {}
  if (computables.length > 0) {
    const desde = computables.reduce((min, a) => (a.desde < min ? a.desde : min), computables[0]!.desde)
    const hasta = computables.reduce((max, a) => (a.hasta > max ? a.hasta : max), computables[0]!.hasta)
    capacidad = await deps.capacidad(empleadoId, desde, hasta)
  }

  const consumo: Record<number, number> = {}
  for (const ausencia of computables) {
    const parcial = consumoPorAnio(ausencia, capacidad)
    for (const [clave, minutos] of Object.entries(parcial)) {
      const indice = Number(clave)
      consumo[indice] = (consumo[indice] ?? 0) + minutos
    }
  }

  return {
    empleadoId,
    anio,
    ...calcularSaldo(
      {
        minutosAsignados: saldo?.minutosAsignados ?? 0,
        minutosArrastrados: saldo?.minutosArrastrados ?? 0,
      },
      consumo,
      anio,
    ),
  }
}

/** Año natural de referencia del saldo vigente. */
export function anioActual(): number {
  return Number(hoyEnZona(process.env.TZ ?? 'Europe/Madrid').slice(0, 4))
}

export type { EstadoAusencia }
