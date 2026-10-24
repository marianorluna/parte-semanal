import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import { AppError } from '@/shared/errors'
import {
  ErrorInforme,
  MINUTOS_CADUCIDAD,
  exigirDentroDeLimite,
  firmarDescarga,
  nombreArchivoInforme,
  validarParametros,
  verificarDescarga,
  type ParametrosInforme,
  type TablaInforme,
  type TipoInforme,
} from '../domain/informe'
import { generarArchivo } from '../infrastructure/exportadores'
import type { DatosSolicitud, DepsInformes, InformeListado } from './ports'

const DIAS_CADUCIDAD_CONTENIDO = 7

function ahora(deps: DepsInformes): Date {
  return deps.ahora?.() ?? new Date()
}

function exigirEmpresa(informe: InformeListado, usuario: UsuarioSesion): void {
  if (informe.empresaId !== usuario.empresaId) {
    throw new AppError('NO_ENCONTRADO', 'El informe no existe')
  }
}

/**
 * Valida y encola un informe. La petición no genera el fichero: el worker lo
 * hace en segundo plano para que 10.000 filas no bloqueen al usuario.
 */
export async function solicitarInforme(
  deps: DepsInformes,
  usuario: UsuarioSesion,
  datos: DatosSolicitud,
): Promise<string> {
  const validacion = validarParametros(datos.tipo, datos.parametros)
  if (!validacion.ok) {
    throw new AppError('VALIDACION', validacion.mensaje, { [validacion.campo]: validacion.mensaje })
  }

  const expiraAt = new Date(ahora(deps).getTime() + DIAS_CADUCIDAD_CONTENIDO * 86_400_000)
  const id = await deps.repo.crear(
    usuario.empresaId,
    usuario.id,
    datos.tipo,
    datos.formato,
    validacion.parametros,
    expiraAt,
  )

  if (deps.encolar) {
    try {
      await deps.encolar.encolar(id)
    } catch (error) {
      // El informe queda PENDIENTE y visible; se puede reintentar sin perderlo.
      console.error('[informes] no se pudo encolar', error)
    }
  }

  return id
}

export function listarInformes(deps: DepsInformes, usuario: UsuarioSesion): Promise<InformeListado[]> {
  return deps.repo.listar(usuario.empresaId)
}

export type TokenDescarga = { token: string; expiraEpoch: number }

export function tokenDescarga(
  informeId: string,
  secreto: string,
  deps: DepsInformes,
): TokenDescarga {
  const expiraEpoch = Math.floor(ahora(deps).getTime() / 1000) + MINUTOS_CADUCIDAD * 60
  return { token: firmarDescarga(informeId, expiraEpoch, secreto), expiraEpoch }
}

export async function descargarInforme(
  deps: DepsInformes,
  usuario: UsuarioSesion,
  informeId: string,
  token: string,
  secreto: string,
): Promise<{ nombreArchivo: string; contenido: Buffer }> {
  const informe = await deps.repo.obtener(informeId)
  if (!informe) throw new AppError('NO_ENCONTRADO', 'El informe no existe')
  exigirEmpresa(informe, usuario)

  const verificacion = verificarDescarga(
    informeId,
    token,
    secreto,
    Math.floor(ahora(deps).getTime() / 1000),
  )
  if (!verificacion.ok) {
    throw new AppError(
      'SIN_PERMISO',
      verificacion.motivo === 'CADUCADO'
        ? 'El enlace de descarga ha caducado. Vuelve a solicitar el informe.'
        : 'El enlace de descarga no es válido',
    )
  }

  if (informe.estado !== 'COMPLETADO') {
    throw new AppError('ESTADO_INVALIDO', 'El informe todavía no está listo')
  }

  const contenido = await deps.repo.contenido(informeId)
  if (!contenido) throw new AppError('NO_ENCONTRADO', 'El informe ha caducado o se ha limpiado')

  return { nombreArchivo: contenido.nombreArchivo, contenido: contenido.contenido }
}

export async function reintentarInforme(
  deps: DepsInformes,
  usuario: UsuarioSesion,
  informeId: string,
): Promise<void> {
  const informe = await deps.repo.obtener(informeId)
  if (!informe) throw new AppError('NO_ENCONTRADO', 'El informe no existe')
  exigirEmpresa(informe, usuario)

  const expiraAt = new Date(ahora(deps).getTime() + DIAS_CADUCIDAD_CONTENIDO * 86_400_000)
  const reencolado = await deps.repo.reintentar(informeId, expiraAt)
  if (!reencolado) {
    throw new AppError('ESTADO_INVALIDO', 'Solo se pueden reintentar informes fallidos')
  }

  if (deps.encolar) await deps.encolar.encolar(informeId)
}

async function construirTabla(
  deps: DepsInformes,
  empresaId: string,
  tipo: TipoInforme,
  parametros: Record<string, unknown>,
): Promise<TablaInforme> {
  const validacion = validarParametros(tipo, parametros)
  if (!validacion.ok) {
    throw new ErrorInforme(`Parámetros inválidos: ${validacion.mensaje}`)
  }

  switch (tipo) {
    case 'CERTIFICACION_MENSUAL': {
      const datos = validacion.parametros as ParametrosInforme['CERTIFICACION_MENSUAL']
      return deps.consultas.certificacionMensual(empresaId, datos.anio, datos.mes)
    }
    case 'LIBRO_JORNADA': {
      const datos = validacion.parametros as ParametrosInforme['LIBRO_JORNADA']
      return deps.consultas.libroJornada(empresaId, datos.desde, datos.hasta)
    }
    case 'COSTES_PROYECTO': {
      const datos = validacion.parametros as ParametrosInforme['COSTES_PROYECTO']
      return deps.consultas.costesProyecto(
        empresaId,
        datos.desde,
        datos.hasta,
        datos.proyectoId ?? null,
      )
    }
    case 'AUSENCIAS': {
      const datos = validacion.parametros as ParametrosInforme['AUSENCIAS']
      return deps.consultas.ausencias(empresaId, datos.desde, datos.hasta)
    }
    case 'HORAS_EXTRA': {
      const datos = validacion.parametros as ParametrosInforme['HORAS_EXTRA']
      return deps.consultas.horasExtra(empresaId, datos.desde, datos.hasta)
    }
    case 'AUDITORIA': {
      const datos = validacion.parametros as ParametrosInforme['AUDITORIA']
      return deps.consultas.auditoria(empresaId, datos.desde, datos.hasta)
    }
  }
}

function referenciaArchivo(tipo: TipoInforme, parametros: Record<string, unknown>): string {
  if (tipo === 'CERTIFICACION_MENSUAL') {
    const anio = String(parametros.anio ?? '')
    const mes = String(parametros.mes ?? '').padStart(2, '0')
    return `${anio}-${mes}`
  }
  return `${String(parametros.desde ?? '')}_${String(parametros.hasta ?? '')}`
}

/**
 * Ejecuta un informe encolado. Idempotente en la práctica: solo procesa si el
 * estado pasa de PENDIENTE a EN_PROCESO, y deja el error visible si falla para
 * que el usuario pueda reintentar.
 */
export async function procesarInforme(deps: DepsInformes, informeId: string): Promise<void> {
  const informe = await deps.repo.obtener(informeId)
  if (!informe) return

  const reclamado = await deps.repo.marcarEnProceso(informeId)
  if (!reclamado) return

  try {
    const tabla = await construirTabla(deps, informe.empresaId, informe.tipo, informe.parametros)
    exigirDentroDeLimite(tabla.filas)

    const contenido = await generarArchivo(tabla, informe.formato)
    const nombreArchivo = nombreArchivoInforme(
      informe.tipo,
      informe.formato,
      referenciaArchivo(informe.tipo, informe.parametros),
    )

    await deps.repo.completar(informeId, nombreArchivo, contenido)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido al generar el informe'
    await deps.repo.fallar(informeId, mensaje)
    throw error
  }
}

export async function limpiarInformesCaducados(deps: DepsInformes): Promise<number> {
  return deps.repo.limpiarCaducados(ahora(deps))
}
