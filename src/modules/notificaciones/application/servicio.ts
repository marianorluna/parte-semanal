import type { TipoNotificacion } from '@/db/schema'
import { formatearRango, type FechaIso, type SemanaIso } from '@/modules/partes/domain/fechas'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { etiquetaEstado } from '@/modules/partes/domain/parte'
import { esNivelAlerta, evaluarRiesgo, type NivelRiesgo } from '@/modules/reporting/domain/riesgo'
import { claveEquipoPendiente, claveRecordatorio, claveRiesgoProyecto, type VentanaAviso } from '../domain/claves'
import type { ConsultasAvisos, NotificacionEntrada, RepositorioNotificaciones } from './ports'

export type DepsAvisos = {
  repo: RepositorioNotificaciones
  consultas: ConsultasAvisos
}

export type ModoAvisos = 'recordatorios' | 'riesgos' | 'todo'

export type OpcionesAvisos = {
  modo: ModoAvisos
  ventana: VentanaAviso
  semana: SemanaIso
  hoy: FechaIso
  dryRun: boolean
  /** Recordatorio manual desde la pantalla de equipo: solo estos usuarios. */
  soloUsuarioIds?: string[]
}

export type NotificacionLote = {
  usuarioId: string
  email: string
  nombre: string
  tipo: TipoNotificacion
  titulo: string
  cuerpo: string
  url: string | null
}

export type ResultadoAvisos = {
  empresas: number
  creadas: number
  omitidas: number
  lote: NotificacionLote[]
}

export type Destinatario = { usuarioId: string; email: string; nombre: string }

type Generado = { entradas: NotificacionEntrada[]; destinatarios: Map<string, Destinatario> }

function vacio(): Generado {
  return { entradas: [], destinatarios: new Map() }
}

export async function generarAvisos(deps: DepsAvisos, opciones: OpcionesAvisos): Promise<ResultadoAvisos> {
  const empresas = await deps.consultas.listarEmpresasActivas()
  const resultado: ResultadoAvisos = { empresas: empresas.length, creadas: 0, omitidas: 0, lote: [] }

  for (const empresa of empresas) {
    const generado = vacio()

    if (opciones.modo === 'recordatorios' || opciones.modo === 'todo') {
      fusionar(generado, await recordatoriosDeTrabajadores(deps, empresa.id, opciones))

      // En modo manual el encargado ya sabe lo que ha pedido: sin resumen propio.
      if (!opciones.soloUsuarioIds) {
        fusionar(generado, await resumenesParaEncargados(deps, empresa.id, opciones))
      }
    }

    if (opciones.modo === 'riesgos' || opciones.modo === 'todo') {
      fusionar(generado, await avisosDeRiesgo(deps, empresa.id, opciones))
    }

    if (opciones.dryRun) {
      resultado.creadas += generado.entradas.length
      resultado.lote.push(...describirLote(generado))
      continue
    }

    const creadas = await deps.repo.crearMuchas(generado.entradas)
    resultado.creadas += creadas.length
    resultado.omitidas += generado.entradas.length - creadas.length
    resultado.lote.push(...describirLote({ entradas: creadas, destinatarios: generado.destinatarios }))
  }

  return resultado
}

function fusionar(destino: Generado, origen: Generado) {
  destino.entradas.push(...origen.entradas)
  for (const [clave, destinatario] of origen.destinatarios) {
    destino.destinatarios.set(clave, destinatario)
  }
}

function describirLote(generado: Generado): NotificacionLote[] {
  return generado.entradas.map((entrada) => {
    const destinatario = generado.destinatarios.get(entrada.usuarioId)
    return {
      usuarioId: entrada.usuarioId,
      email: destinatario?.email ?? '',
      nombre: destinatario?.nombre ?? '',
      tipo: entrada.tipo,
      titulo: entrada.titulo,
      cuerpo: entrada.cuerpo,
      url: entrada.url,
    }
  })
}

async function recordatoriosDeTrabajadores(
  deps: DepsAvisos,
  empresaId: string,
  opciones: OpcionesAvisos,
): Promise<Generado> {
  const pendientes = await deps.consultas.usuariosConPartePendiente(empresaId, opciones.semana)
  const filtro = opciones.soloUsuarioIds ? new Set(opciones.soloUsuarioIds) : null
  const generado = vacio()

  for (const pendiente of pendientes) {
    if (filtro && !filtro.has(pendiente.usuarioId)) continue

    const estado = pendiente.estadoParte
    const titulo =
      estado === 'RECHAZADO'
        ? 'Tu parte fue rechazado'
        : estado === 'BORRADOR'
          ? 'Tu parte sigue en borrador'
          : 'Te faltan horas por enviar'

    const cuerpo =
      estado === null
        ? `No has cargado horas de la semana ${opciones.semana.isoWeek} (${formatearRango(opciones.semana.weekStart, opciones.semana.weekEnd)}). Entra, añade tus horas y envíalas.`
        : estado === 'RECHAZADO'
          ? `El parte de la semana ${opciones.semana.isoWeek} fue rechazado. Corrige lo indicado y vuelve a enviarlo.`
          : `El parte de la semana ${opciones.semana.isoWeek} sigue en ${etiquetaEstado(estado).toLowerCase()}. Revísalo y envíalo.`

    generado.destinatarios.set(pendiente.usuarioId, pendiente)
    generado.entradas.push({
      empresaId,
      usuarioId: pendiente.usuarioId,
      tipo: 'RECORDATORIO_PARTE',
      titulo,
      cuerpo,
      url: `/mi-semana?y=${opciones.semana.isoYear}&w=${opciones.semana.isoWeek}`,
      claveIdempotencia: claveRecordatorio(
        pendiente.usuarioId,
        opciones.semana,
        opciones.ventana,
        opciones.hoy,
      ),
      metadata: {
        isoYear: opciones.semana.isoYear,
        isoWeek: opciones.semana.isoWeek,
        estadoParte: estado,
      },
    })
  }

  return generado
}

async function resumenesParaEncargados(
  deps: DepsAvisos,
  empresaId: string,
  opciones: OpcionesAvisos,
): Promise<Generado> {
  const encargados = await deps.consultas.equipoPendientePorEncargado(empresaId, opciones.semana)
  const generado = vacio()

  for (const encargado of encargados) {
    const nombres = encargado.nombresPendientes.slice(0, 5).join(', ')
    const resto = encargado.nombresPendientes.length > 5 ? ` y ${encargado.nombresPendientes.length - 5} más` : ''

    generado.destinatarios.set(encargado.usuarioId, encargado)
    generado.entradas.push({
      empresaId,
      usuarioId: encargado.usuarioId,
      tipo: 'EQUIPO_PENDIENTE',
      titulo: `${encargado.pendientes} ${encargado.pendientes === 1 ? 'persona' : 'personas'} sin enviar horas`,
      cuerpo: `Semana ${opciones.semana.isoWeek}: ${nombres}${resto}. Revísalo en Equipo para recordarles o aprobar lo enviado.`,
      url: `/control/equipo?y=${opciones.semana.isoYear}&w=${opciones.semana.isoWeek}`,
      claveIdempotencia: claveEquipoPendiente(
        encargado.usuarioId,
        opciones.semana,
        opciones.ventana,
        opciones.hoy,
      ),
      metadata: {
        isoYear: opciones.semana.isoYear,
        isoWeek: opciones.semana.isoWeek,
        pendientes: encargado.pendientes,
      },
    })
  }

  return generado
}

const TITULO_RIESGO: Record<NivelRiesgo, string> = {
  AGOTADO: 'Presupuesto agotado',
  CRITICO: 'Riesgo alto de desviación',
  AVISO: 'Consumo por encima del ritmo previsto',
  OK: 'Proyecto en ritmo',
  SIN_PRESUPUESTO: 'Proyecto sin presupuesto',
  SIN_PLAZO: 'Proyecto sin plazo',
}

async function avisosDeRiesgo(
  deps: DepsAvisos,
  empresaId: string,
  opciones: OpcionesAvisos,
): Promise<Generado> {
  const proyectos = await deps.consultas.consumoPorProyecto(empresaId)
  const enAlerta = proyectos
    .map((proyecto) => ({
      proyecto,
      riesgo: evaluarRiesgo({
        minutosConsumidos: proyecto.minutos,
        horasPresupuesto: proyecto.horasPresupuesto,
        fechaInicio: proyecto.fechaInicio,
        fechaFin: proyecto.fechaFin,
        hoy: opciones.hoy,
      }),
    }))
    .filter((fila) => esNivelAlerta(fila.riesgo.nivel))

  const generado = vacio()
  if (enAlerta.length === 0) return generado

  const encargados = await deps.consultas.encargadosDeProyectos(
    enAlerta.map((fila) => fila.proyecto.proyectoId),
  )
  const admins = await deps.consultas.adminsDeEmpresa(empresaId)

  for (const { proyecto, riesgo } of enAlerta) {
    const suyos = encargados.filter((encargado) => encargado.proyectoId === proyecto.proyectoId)
    const destinatariosDelAviso: Destinatario[] = suyos.length > 0 ? suyos : admins

    for (const destinatario of destinatariosDelAviso) {
      generado.destinatarios.set(destinatario.usuarioId, destinatario)
      generado.entradas.push({
        empresaId,
        usuarioId: destinatario.usuarioId,
        tipo: 'RIESGO_PROYECTO',
        titulo: `${TITULO_RIESGO[riesgo.nivel]}: ${proyecto.codigo}`,
        cuerpo: `${proyecto.nombre}. ${riesgo.detalle} Consumidas ${formatearHorasReloj(proyecto.minutos)} (${riesgo.consumoPct}% del presupuesto).`,
        url: `/control/proyectos/${proyecto.proyectoId}`,
        claveIdempotencia: claveRiesgoProyecto(
          destinatario.usuarioId,
          proyecto.proyectoId,
          riesgo.nivel,
          opciones.hoy,
        ),
        metadata: {
          proyectoId: proyecto.proyectoId,
          nivel: riesgo.nivel,
          consumoPct: riesgo.consumoPct,
          plazoPct: riesgo.plazoPct,
          proyeccionPct: riesgo.proyeccionPct,
        },
      })
    }
  }

  return generado
}

/** Recordatorio puntual desde la pantalla de equipo, para los pendientes filtrados. */
export async function recordarPendientes(
  deps: DepsAvisos,
  opciones: {
    empresaId: string
    usuarioIds: string[]
    semana: SemanaIso
    hoy: FechaIso
  },
): Promise<ResultadoAvisos> {
  if (opciones.usuarioIds.length === 0) {
    return { empresas: 0, creadas: 0, omitidas: 0, lote: [] }
  }

  const generado = await recordatoriosDeTrabajadores(deps, opciones.empresaId, {
    modo: 'recordatorios',
    ventana: 'manual',
    semana: opciones.semana,
    hoy: opciones.hoy,
    dryRun: false,
    soloUsuarioIds: opciones.usuarioIds,
  })

  const creadas = await deps.repo.crearMuchas(generado.entradas)

  return {
    empresas: 1,
    creadas: creadas.length,
    omitidas: generado.entradas.length - creadas.length,
    lote: describirLote({ entradas: creadas, destinatarios: generado.destinatarios }),
  }
}
