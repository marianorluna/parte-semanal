import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import { esFechaIso } from '@/modules/partes/domain/fechas'
import { AppError } from '@/shared/errors'
import {
  calcularLinea,
  ejecucionPresupuesto,
  validarTarifa,
  type TarifaCoste,
} from '../domain/coste'
import type {
  DatosPresupuesto,
  DatosTarifa,
  EjecucionProyecto,
  FiltroInformeCoste,
  LineaInformeCoste,
  PresupuestoListado,
  RepositorioCoste,
  ResumenCosteParte,
  TarifaListada,
} from './ports'

export type DepsCoste = {
  repo: RepositorioCoste
}

export function listarTarifas(deps: DepsCoste, usuario: UsuarioSesion): Promise<TarifaListada[]> {
  return deps.repo.listarTarifas(usuario.empresaId)
}

export function listarPresupuestos(
  deps: DepsCoste,
  usuario: UsuarioSesion,
): Promise<PresupuestoListado[]> {
  return deps.repo.listarPresupuestos(usuario.empresaId)
}

function validarDatosTarifa(datos: DatosTarifa): DatosTarifa {
  const error = validarTarifa(datos)
  if (error) throw new AppError('VALIDACION', error.mensaje, { [error.campo]: error.mensaje })

  if (!esFechaIso(datos.desde)) {
    throw new AppError('VALIDACION', 'La fecha de inicio no es válida', { desde: 'Fecha inválida' })
  }
  if (datos.hasta !== null && !esFechaIso(datos.hasta)) {
    throw new AppError('VALIDACION', 'La fecha final no es válida', { hasta: 'Fecha inválida' })
  }

  return {
    ...datos,
    categoria: datos.empleadoId ? null : datos.categoria?.trim() || null,
  }
}

async function comprobarSolape(
  deps: DepsCoste,
  usuario: UsuarioSesion,
  datos: DatosTarifa,
  excluirId: string | null,
): Promise<void> {
  if (!datos.activo) return
  const solapa = await deps.repo.existeSolape(usuario.empresaId, datos, excluirId)
  if (solapa) {
    throw new AppError('VALIDACION', 'Ya existe una tarifa activa que cubre esas fechas para el mismo ámbito', {
      desde: 'Vigencia solapada con otra tarifa',
    })
  }
}

export async function crearTarifa(
  deps: DepsCoste,
  usuario: UsuarioSesion,
  datos: DatosTarifa,
): Promise<string> {
  const validos = validarDatosTarifa(datos)
  await comprobarSolape(deps, usuario, validos, null)
  return deps.repo.crearTarifa(usuario.empresaId, validos)
}

export async function actualizarTarifa(
  deps: DepsCoste,
  usuario: UsuarioSesion,
  tarifaId: string,
  datos: DatosTarifa,
): Promise<void> {
  const pertenece = await deps.repo.perteneceTarifaAEmpresa(tarifaId, usuario.empresaId)
  if (!pertenece) throw new AppError('NO_ENCONTRADO', 'La tarifa no existe')

  const validos = validarDatosTarifa(datos)
  await comprobarSolape(deps, usuario, validos, tarifaId)
  await deps.repo.actualizarTarifa(tarifaId, validos)
}

export async function eliminarTarifa(
  deps: DepsCoste,
  usuario: UsuarioSesion,
  tarifaId: string,
): Promise<void> {
  const pertenece = await deps.repo.perteneceTarifaAEmpresa(tarifaId, usuario.empresaId)
  if (!pertenece) throw new AppError('NO_ENCONTRADO', 'La tarifa no existe')
  await deps.repo.eliminarTarifa(tarifaId)
}

export async function crearPresupuesto(
  deps: DepsCoste,
  usuario: UsuarioSesion,
  proyectoId: string,
  datos: DatosPresupuesto,
): Promise<number> {
  const pertenece = await deps.repo.proyectoPerteneceAEmpresa(proyectoId, usuario.empresaId)
  if (!pertenece) throw new AppError('NO_ENCONTRADO', 'El proyecto no existe')

  if (!Number.isInteger(datos.importeCents) || datos.importeCents <= 0) {
    throw new AppError('VALIDACION', 'El importe del presupuesto debe ser mayor que cero', {
      importe: 'Importe inválido',
    })
  }
  if (
    datos.horasPresupuesto !== null &&
    (!Number.isInteger(datos.horasPresupuesto) || datos.horasPresupuesto < 0)
  ) {
    throw new AppError('VALIDACION', 'Las horas de presupuesto no son válidas', {
      horas: 'Horas inválidas',
    })
  }

  return deps.repo.crearPresupuesto(proyectoId, datos, usuario.id)
}

/**
 * Calcula y persiste el snapshot de coste de un parte aprobado. Idempotente:
 * sustituye el anterior. Sin tarifa vigente deja la línea a 0 con aviso, nunca
 * bloquea la aprobación.
 */
export async function costearParte(deps: DepsCoste, parteId: string): Promise<ResumenCosteParte> {
  const parte = await deps.repo.parteParaCoste(parteId)
  if (!parte) throw new AppError('NO_ENCONTRADO', 'El parte no existe')
  if (parte.estado !== 'APROBADO' && parte.estado !== 'BLOQUEADO') {
    throw new AppError('ESTADO_INVALIDO', 'Solo se puede costear un parte aprobado o bloqueado')
  }

  const tarifas: TarifaCoste[] = await deps.repo.tarifasActivas(parte.empresaId)
  const opciones = { empleadoId: parte.empleadoId, categoria: parte.empleadoCategoria }

  const calculadas = parte.lineas.map((linea) => {
    const calculada = calcularLinea({ fecha: linea.fecha, minutos: linea.minutos }, tarifas, opciones)
    return {
      imputacionId: linea.imputacionId,
      tareaId: linea.tareaId,
      proyectoId: linea.proyectoId,
      fecha: linea.fecha,
      minutos: linea.minutos,
      ...calculada,
    }
  })

  await deps.repo.guardarCostes(parteId, calculadas)
  return resumenCoste(parteId, await deps.repo.costesDeParte(parteId))
}

function resumenCoste(parteId: string, lineas: ResumenCosteParte['lineas']): ResumenCosteParte {
  return {
    parteId,
    totalCents: lineas.reduce((total, linea) => total + linea.importeCents, 0),
    minutos: lineas.reduce((total, linea) => total + linea.minutos, 0),
    sinTarifa: lineas.filter((linea) => linea.sinTarifa).length,
    lineas,
  }
}

export async function costeDeParte(deps: DepsCoste, parteId: string): Promise<ResumenCosteParte> {
  return resumenCoste(parteId, await deps.repo.costesDeParte(parteId))
}

export type InformeCoste = {
  lineas: LineaInformeCoste[]
  totalCents: number
  minutos: number
  lineasSinTarifa: number
}

export async function informeCoste(
  deps: DepsCoste,
  usuario: UsuarioSesion,
  filtro: FiltroInformeCoste,
  permitidos: string[] | null,
): Promise<InformeCoste> {
  if (!esFechaIso(filtro.desde) || !esFechaIso(filtro.hasta)) {
    throw new AppError('VALIDACION', 'Las fechas del informe no son válidas')
  }
  if (filtro.desde > filtro.hasta) {
    throw new AppError('VALIDACION', 'La fecha inicial no puede superar la final')
  }

  const lineas = await deps.repo.lineasInforme(usuario.empresaId, filtro, permitidos)

  return {
    lineas,
    totalCents: lineas.reduce((total, linea) => total + linea.importeCents, 0),
    minutos: lineas.reduce((total, linea) => total + linea.minutos, 0),
    lineasSinTarifa: lineas.filter((linea) => linea.sinTarifa).length,
  }
}

export type EjecucionConPorcentaje = EjecucionProyecto & {
  porcentaje: number
  restanteCents: number | null
  excedido: boolean
}

export async function ejecucionPresupuestaria(
  deps: DepsCoste,
  usuario: UsuarioSesion,
  permitidos: string[] | null,
): Promise<EjecucionConPorcentaje[]> {
  const filas = await deps.repo.ejecucionProyectos(usuario.empresaId, permitidos)

  return filas.map((fila) => {
    if (fila.presupuestoCents === null) {
      return { ...fila, porcentaje: 0, restanteCents: null, excedido: false }
    }

    const ejecucion = ejecucionPresupuesto(fila.gastadoCents, fila.presupuestoCents)
    return {
      ...fila,
      porcentaje: ejecucion.porcentaje,
      restanteCents: ejecucion.restanteCents,
      excedido: ejecucion.excedido,
    }
  })
}
