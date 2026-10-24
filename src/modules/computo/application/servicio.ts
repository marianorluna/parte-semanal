import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import { esFechaIso } from '@/modules/partes/domain/fechas'
import { AppError } from '@/shared/errors'
import {
  computarSemana,
  resumir,
  type ResumenComputo,
  type TipoHora,
  validarRegla,
} from '../domain/reglas'
import type {
  AsignacionConvenio,
  ConvenioCompleto,
  ConvenioResumen,
  DatosConvenio,
  DatosRegla,
  RepositorioComputo,
  ResumenParte,
  ResultadoGuardado,
} from './ports'

export type DepsComputo = {
  repo: RepositorioComputo
  /** Fechas festivas de la semana, según el calendario del empleado. */
  diasFestivos: (empleadoId: string, weekStart: string) => Promise<readonly string[]>
}

export function listarConvenios(deps: DepsComputo, usuario: UsuarioSesion): Promise<ConvenioResumen[]> {
  return deps.repo.listar(usuario.empresaId)
}

export function obtenerConvenio(deps: DepsComputo, convenioId: string): Promise<ConvenioCompleto | null> {
  return deps.repo.obtener(convenioId)
}

export function listarAsignaciones(
  deps: DepsComputo,
  usuario: UsuarioSesion,
): Promise<AsignacionConvenio[]> {
  return deps.repo.listarAsignaciones(usuario.empresaId)
}

function validarConvenio(datos: DatosConvenio): DatosConvenio {
  const codigo = datos.codigo.trim().toUpperCase()
  const nombre = datos.nombre.trim()

  if (codigo.length < 2) {
    throw new AppError('VALIDACION', 'El código del convenio es obligatorio', {
      codigo: 'Indica un código de al menos 2 caracteres',
    })
  }
  if (nombre.length < 3) {
    throw new AppError('VALIDACION', 'El nombre del convenio es obligatorio', {
      nombre: 'Indica un nombre de al menos 3 caracteres',
    })
  }

  return { codigo, nombre }
}

async function exigirConvenioDeEmpresa(
  deps: DepsComputo,
  usuario: UsuarioSesion,
  convenioId: string,
): Promise<void> {
  const pertenece = await deps.repo.perteneceAEmpresa(convenioId, usuario.empresaId)
  if (!pertenece) throw new AppError('NO_ENCONTRADO', 'El convenio no existe')
}

export async function crearConvenio(
  deps: DepsComputo,
  usuario: UsuarioSesion,
  datos: DatosConvenio,
): Promise<string> {
  return deps.repo.crear(usuario.empresaId, validarConvenio(datos))
}

export async function actualizarConvenio(
  deps: DepsComputo,
  usuario: UsuarioSesion,
  convenioId: string,
  datos: DatosConvenio,
): Promise<number> {
  await exigirConvenioDeEmpresa(deps, usuario, convenioId)
  return deps.repo.actualizar(convenioId, validarConvenio(datos))
}

export async function alternarConvenio(
  deps: DepsComputo,
  usuario: UsuarioSesion,
  convenioId: string,
  activo: boolean,
): Promise<void> {
  await exigirConvenioDeEmpresa(deps, usuario, convenioId)
  await deps.repo.alternar(convenioId, activo)
}

function validarDatosRegla(datos: DatosRegla): DatosRegla {
  const error = validarRegla(datos)
  if (error) throw new AppError('VALIDACION', error.mensaje, { [error.campo]: error.mensaje })

  if (datos.topeDiarioMin !== null && datos.topeSemanalMin !== null && datos.topeDiarioMin > datos.topeSemanalMin) {
    throw new AppError('VALIDACION', 'El tope diario no puede superar el semanal', {
      topeDiario: 'Tope diario mayor que el semanal',
    })
  }

  return datos
}

export async function guardarRegla(
  deps: DepsComputo,
  usuario: UsuarioSesion,
  convenioId: string,
  datos: DatosRegla,
): Promise<void> {
  await exigirConvenioDeEmpresa(deps, usuario, convenioId)
  await deps.repo.guardarRegla(convenioId, validarDatosRegla(datos))
}

export async function eliminarRegla(
  deps: DepsComputo,
  usuario: UsuarioSesion,
  convenioId: string,
  reglaId: string,
): Promise<void> {
  await exigirConvenioDeEmpresa(deps, usuario, convenioId)
  await deps.repo.eliminarRegla(convenioId, reglaId)
}

export async function asignarEmpleadoAConvenio(
  deps: DepsComputo,
  usuario: UsuarioSesion,
  convenioId: string,
  empleadoId: string,
  desde: string,
): Promise<void> {
  await exigirConvenioDeEmpresa(deps, usuario, convenioId)
  if (!esFechaIso(desde)) {
    throw new AppError('VALIDACION', 'La fecha de inicio no es válida', { desde: 'Fecha inválida' })
  }
  await deps.repo.asignarEmpleado(empleadoId, convenioId, desde)
}

export async function quitarAsignacion(
  deps: DepsComputo,
  usuario: UsuarioSesion,
  asignacionId: string,
): Promise<void> {
  const asignaciones = await deps.repo.listarAsignaciones(usuario.empresaId)
  if (!asignaciones.some((asignacion) => asignacion.id === asignacionId)) {
    throw new AppError('NO_ENCONTRADO', 'La asignación no existe')
  }
  await deps.repo.quitarAsignacion(asignacionId)
}

export type ResultadoComputoParte = {
  convenioId: string | null
  convenioVersion: number | null
  resumen: ResumenComputo
}

/**
 * Calcula y persiste el cómputo de un parte aprobado. Es idempotente: sustituye
 * los resultados anteriores del parte. Sin convenio aplica factor 1, de modo que
 * el comportamiento previo no cambia.
 */
export async function computarParte(
  deps: DepsComputo,
  parteId: string,
): Promise<ResultadoComputoParte> {
  const parte = await deps.repo.obtenerParte(parteId)
  if (!parte) throw new AppError('NO_ENCONTRADO', 'El parte no existe')
  if (parte.estado !== 'APROBADO' && parte.estado !== 'BLOQUEADO') {
    throw new AppError('ESTADO_INVALIDO', 'Solo se puede computar un parte aprobado o bloqueado')
  }

  const convenio = await deps.repo.convenioDeEmpleado(parte.empleadoId, parte.weekStart)
  const festivos = new Set(await deps.diasFestivos(parte.empleadoId, parte.weekStart))

  const tramos = computarSemana(
    parte.imputaciones.map((linea) => ({
      imputacionId: linea.id,
      fecha: linea.fecha,
      minutos: linea.minutos,
      esFestivo: festivos.has(linea.fecha),
    })),
    convenio?.reglas ?? [],
  )

  await deps.repo.guardarResultados(
    parteId,
    convenio ? { id: convenio.id, version: convenio.version } : null,
    tramos,
  )

  return {
    convenioId: convenio?.id ?? null,
    convenioVersion: convenio?.version ?? null,
    resumen: resumir(tramos),
  }
}

export async function resumenDeParte(deps: DepsComputo, parteId: string): Promise<ResumenParte> {
  const tramos = await deps.repo.resultadosDeParte(parteId)
  const primero = tramos[0]
  const convenioId = primero?.convenioId ?? null

  let convenioNombre: string | null = null
  if (convenioId) {
    const convenio = await deps.repo.obtener(convenioId)
    convenioNombre = convenio?.nombre ?? null
  }

  return {
    parteId,
    convenioId,
    convenioNombre,
    convenioVersion: primero?.convenioVersion ?? null,
    resumen: resumir(tramos),
    tramos,
  }
}

export type AgrupadoPorTipo = { tipoHora: TipoHora; minutosBase: number; minutosComputados: number }

export function agruparPorTipo(resultados: readonly ResultadoGuardado[]): AgrupadoPorTipo[] {
  const mapa = new Map<TipoHora, AgrupadoPorTipo>()

  for (const resultado of resultados) {
    const actual = mapa.get(resultado.tipoHora) ?? {
      tipoHora: resultado.tipoHora,
      minutosBase: 0,
      minutosComputados: 0,
    }
    actual.minutosBase += resultado.minutosBase
    actual.minutosComputados += resultado.minutosComputados
    mapa.set(resultado.tipoHora, actual)
  }

  return [...mapa.values()].sort((a, b) => a.tipoHora.localeCompare(b.tipoHora))
}
