/**
 * Builders de los datos de fase 2 del seed demo.
 *
 * Cada función recibe la transacción del seed y escribe un bloque coherente:
 * calendarios, convenios, ausencias, costes, cierres, informes, avisos,
 * correo, API/webhooks y auditoría. Ninguna decide el orden global: eso es
 * responsabilidad del orquestador (`demo.ts`).
 */

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import type { Db } from '@/db/client'
import {
  apiIdempotencia,
  apiKey,
  ausencia,
  auditoria,
  calendario,
  convenio,
  costeHora,
  emailEnvio,
  empleadoCalendario,
  empleadoConvenio,
  excepcionCalendario,
  festivo,
  informe,
  jornadaTeorica,
  notificacion,
  outbox,
  parte,
  periodoCerrado,
  preferenciaAviso,
  presupuestoProyecto,
  reglaComputo,
  saldoVacaciones,
  tipoAusencia,
  webhook,
  webhookEntrega,
} from '@/db/schema'
import type { FormatoInforme, TipoNotificacion } from '@/db/schema'
import { festivosDeReferencia } from '@/modules/calendario/domain/festivos-espana'
import { rangoMes, rangoSemana, type TipoPeriodo } from '@/modules/cierre/domain/cierre'
import { claveEmail } from '@/modules/email/domain/email'
import { construirEmail, etiquetaPlantilla, VERSION_PLANTILLAS } from '@/modules/email/domain/plantillas'
import { consultasInformes } from '@/modules/informes/infrastructure/consultas'
import { generarArchivo } from '@/modules/informes/infrastructure/exportadores'
import { nombreArchivoInforme, type TablaInforme } from '@/modules/informes/domain/informe'
import {
  claveEquipoPendiente,
  claveRecordatorio,
  claveRiesgoProyecto,
} from '@/modules/notificaciones/domain/claves'
import {
  aFecha,
  semanaIsoDe,
  sumarDias,
  type FechaIso,
  type SemanaIso,
} from '@/modules/partes/domain/fechas'
import {
  AUSENCIAS_DEMO,
  CALENDARIOS_DEMO,
  CASOS,
  CONVENIOS_DEMO,
  SEMANAS_DEMO,
  TARIFAS_DEMO,
  TIPOS_AUSENCIA_DEMO,
  enLotes,
  exigir,
  type CalendarioSeed,
  type ConvenioSeed,
  type EmpleadoSeed,
  type ParteSeed,
  type ProyectoSeed,
  type TarifaSeed,
  type UsuarioSeed,
} from './demo-datos'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const APP_URL = process.env.APP_URL ?? 'https://horas.levitec.marianorluna.com'
const HASH_DEMO = 'f'.repeat(64)

function fechaHora(fecha: FechaIso, hora: number, minuto = 0): Date {
  return new Date(`${fecha}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00.000Z`)
}

function anioDe(fecha: FechaIso): number {
  return Number(fecha.slice(0, 4))
}

function diasEntre(desde: FechaIso, hasta: FechaIso): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000)
}

function mensajeDeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 400)
  return 'Error desconocido al generar el informe'
}

async function insertarEnLotes<T>(insertar: (lote: T[]) => Promise<unknown>, filas: readonly T[]): Promise<void> {
  for (const lote of enLotes(filas)) {
    if (lote.length > 0) await insertar(lote)
  }
}

/* -------------------------------------------------------------------------- */
/* Calendario laboral                                                         */
/* -------------------------------------------------------------------------- */

export type ResultadoCalendarios = {
  calendarios: CalendarioSeed[]
  predeterminado: CalendarioSeed
  festivos: number
  excepciones: number
}

function fechasDeVentana(semanaActual: SemanaIso, hoy: FechaIso): FechaIso[] {
  const inicio = sumarDias(semanaActual.weekStart, -7 * SEMANAS_DEMO)
  const fin = sumarDias(hoy, 7)
  const fechas: FechaIso[] = []
  for (let fecha = inicio; fecha <= fin; fecha = sumarDias(fecha, 1)) fechas.push(fecha)
  return fechas
}

export async function sembrarCalendarios(
  tx: Tx,
  empresaId: string,
  semanaActual: SemanaIso,
  hoy: FechaIso,
  empleados: readonly EmpleadoSeed[],
): Promise<ResultadoCalendarios> {
  const inicioVigencia = sumarDias(semanaActual.weekStart, -7 * SEMANAS_DEMO)

  const insertados = await tx
    .insert(calendario)
    .values(
      CALENDARIOS_DEMO.map((calendarioDemo) => ({
        empresaId,
        codigo: calendarioDemo.codigo,
        nombre: calendarioDemo.nombre,
        ambito: calendarioDemo.ambito,
        comunidad: calendarioDemo.comunidad,
        diasSemana: [...calendarioDemo.diasSemana],
        horasDiariasMin: calendarioDemo.horasDiariasMin,
        vigenteDesde: inicioVigencia,
        esPredeterminado: calendarioDemo.esPredeterminado,
        activo: calendarioDemo.activo,
        version: calendarioDemo.esPredeterminado ? 3 : 1,
      })),
    )
    .returning({ id: calendario.id, codigo: calendario.codigo })

  const idPorCodigo = new Map(insertados.map((fila) => [fila.codigo, fila.id]))
  const anios = [...new Set(fechasDeVentana(semanaActual, hoy).map(anioDe))]

  // Festivo de empresa y festivo local abierto: dos variantes que la pantalla
  // de calendario muestra con aspecto distinto al festivo de catálogo.
  const diaEmpresa = sumarDias(semanaActual.weekStart, -7 * CASOS.semanaFestivoTrabajado + 2)
  const diaLocalAbierto = sumarDias(semanaActual.weekStart, -7 * 7 + 1)

  type AmbitoFestivoDemo = 'NACIONAL' | 'CCAA' | 'PROVINCIA' | 'LOCAL' | 'EMPRESA'
  type DatosFestivoDemo = {
    nombre: string
    ambito: AmbitoFestivoDemo
    esLaborable: boolean
    origen: 'SEED' | 'ADMIN'
  }

  const filasFestivo: {
    calendarioId: string
    fecha: FechaIso
    nombre: string
    ambito: AmbitoFestivoDemo
    esLaborable: boolean
    origen: 'SEED' | 'ADMIN'
  }[] = []
  const calendarios: CalendarioSeed[] = []

  for (const calendarioDemo of CALENDARIOS_DEMO) {
    const calendarioId = exigir(idPorCodigo.get(calendarioDemo.codigo), 'Calendario sin id')
    const porFecha = new Map<FechaIso, DatosFestivoDemo>()

    if (calendarioDemo.activo) {
      for (const anio of anios) {
        for (const referencia of festivosDeReferencia(anio, calendarioDemo.comunidad ?? undefined)) {
          if (porFecha.has(referencia.fecha)) continue
          porFecha.set(referencia.fecha, {
            nombre: referencia.nombre,
            ambito: referencia.ambito,
            esLaborable: false,
            origen: 'SEED',
          })
        }
      }

      if (!porFecha.has(diaEmpresa)) {
        porFecha.set(diaEmpresa, {
          nombre: 'Día de la empresa',
          ambito: 'EMPRESA',
          esLaborable: false,
          origen: 'ADMIN',
        })
      }

      if (!porFecha.has(diaLocalAbierto)) {
        porFecha.set(diaLocalAbierto, {
          nombre: 'Fiesta local trasladada (laborable)',
          ambito: 'LOCAL',
          esLaborable: true,
          origen: 'ADMIN',
        })
      }
    }

    for (const [fecha, datos] of porFecha) filasFestivo.push({ calendarioId, fecha, ...datos })

    calendarios.push({
      id: calendarioId,
      codigo: calendarioDemo.codigo,
      version: calendarioDemo.esPredeterminado ? 3 : 1,
      diasSemana: calendarioDemo.diasSemana,
      festivos: new Map([...porFecha].map(([fecha, datos]) => [fecha, datos.esLaborable])),
      excepciones: new Map(),
      horasDiariasMin: calendarioDemo.horasDiariasMin,
    })
  }

  await insertarEnLotes((lote) => tx.insert(festivo).values(lote), filasFestivo)

  // Un puente cerrado y un sábado abierto: casos que cambian la rejilla.
  const diaPuente = sumarDias(semanaActual.weekStart, -7 * 4 + 4)
  const diaSabadoAbierto = sumarDias(semanaActual.weekStart, -7 * 2 + 5)
  const filasExcepcion = CALENDARIOS_DEMO.filter((calendarioDemo) => calendarioDemo.activo).flatMap(
    (calendarioDemo) => {
      const calendarioId = exigir(idPorCodigo.get(calendarioDemo.codigo), 'Calendario sin id')
      return [
        { calendarioId, fecha: diaPuente, laborable: false, motivo: 'Puente de la empresa' },
        { calendarioId, fecha: diaSabadoAbierto, laborable: true, motivo: 'Sábado de cierre de obra' },
      ]
    },
  )
  await tx.insert(excepcionCalendario).values(filasExcepcion)

  for (const calendarioActivo of CALENDARIOS_DEMO.filter((calendarioDemo) => calendarioDemo.activo)) {
    const id = exigir(idPorCodigo.get(calendarioActivo.codigo), 'Calendario sin id')
    const entrada = exigir(
      calendarios.find((candidato) => candidato.id === id),
      'Calendario sin memoria',
    )
    entrada.excepciones.set(diaPuente, false)
    entrada.excepciones.set(diaSabadoAbierto, true)
  }

  const idPredeterminado = exigir(idPorCodigo.get('DEMO-MD'), 'Falta el calendario predeterminado')
  const idSabado = exigir(idPorCodigo.get('DEMO-SAB'), 'Falta el calendario de sábados')
  const parcial = exigir(empleados[CASOS.indiceJornadaParcial], 'Falta el empleado a jornada parcial')

  await tx.insert(jornadaTeorica).values([
    {
      calendarioId: idPredeterminado,
      empleadoId: null,
      desde: inicioVigencia,
      horasSemanalesMin: 2_400,
      horasDiariasMin: 480,
    },
    {
      calendarioId: idSabado,
      empleadoId: null,
      desde: inicioVigencia,
      horasSemanalesMin: 2_520,
      horasDiariasMin: 420,
    },
    {
      calendarioId: idPredeterminado,
      empleadoId: parcial.id,
      desde: inicioVigencia,
      horasSemanalesMin: 1_200,
      horasDiariasMin: 240,
    },
  ])

  await tx.insert(empleadoCalendario).values(
    CASOS.indicesCalendarioSabado.map((indice) => ({
      empleadoId: exigir(empleados[indice], 'Empleado de sábado inexistente').id,
      calendarioId: idSabado,
      desde: inicioVigencia,
    })),
  )

  return {
    calendarios,
    predeterminado: exigir(
      calendarios.find((candidato) => candidato.id === idPredeterminado),
      'Sin calendario predeterminado',
    ),
    festivos: filasFestivo.length,
    excepciones: filasExcepcion.length,
  }
}

export function calendarioDeEmpleado(
  calendarios: readonly CalendarioSeed[],
  indiceEmpleado: number,
): CalendarioSeed {
  if (CASOS.indicesCalendarioSabado.includes(indiceEmpleado)) {
    const sabado = calendarios.find((candidato) => candidato.codigo === 'DEMO-SAB')
    if (sabado) return sabado
  }
  return exigir(
    calendarios.find((candidato) => candidato.codigo === 'DEMO-MD'),
    'Falta el calendario predeterminado',
  )
}

/* -------------------------------------------------------------------------- */
/* Convenios y cómputo                                                        */
/* -------------------------------------------------------------------------- */

export type ResultadoConvenios = {
  convenios: ConvenioSeed[]
  porEmpleado: Map<string, ConvenioSeed>
}

export async function sembrarConvenios(
  tx: Tx,
  empresaId: string,
  empleados: readonly EmpleadoSeed[],
  hoy: FechaIso,
  convenioPorEmpleado: (indice: number) => string | null,
): Promise<ResultadoConvenios> {
  const inicioVigencia = sumarDias(hoy, -140)

  const cabeceras = await tx
    .insert(convenio)
    .values(
      CONVENIOS_DEMO.map((convenioDemo) => ({
        empresaId,
        codigo: convenioDemo.codigo,
        nombre: convenioDemo.nombre,
        activo: convenioDemo.activo,
        version: convenioDemo.version,
      })),
    )
    .returning({ id: convenio.id, codigo: convenio.codigo })

  const idPorCodigo = new Map(cabeceras.map((fila) => [fila.codigo, fila.id]))

  const reglasInsertadas = await tx
    .insert(reglaComputo)
    .values(
      CONVENIOS_DEMO.flatMap((convenioDemo) =>
        convenioDemo.reglas.map((regla) => ({
          convenioId: exigir(idPorCodigo.get(convenioDemo.codigo), 'Convenio sin id'),
          tipoHora: regla.tipoHora,
          factorBps: regla.factorBps,
          aplicaEn: regla.aplicaEn,
          topeDiarioMin: regla.topeDiarioMin,
          topeSemanalMin: regla.topeSemanalMin,
          requiereAutorizacion: regla.requiereAutorizacion,
          prioridad: regla.prioridad,
          activo: true,
        })),
      ),
    )
    .returning({
      id: reglaComputo.id,
      convenioId: reglaComputo.convenioId,
      tipoHora: reglaComputo.tipoHora,
      factorBps: reglaComputo.factorBps,
      aplicaEn: reglaComputo.aplicaEn,
      topeDiarioMin: reglaComputo.topeDiarioMin,
      topeSemanalMin: reglaComputo.topeSemanalMin,
      requiereAutorizacion: reglaComputo.requiereAutorizacion,
      prioridad: reglaComputo.prioridad,
      activo: reglaComputo.activo,
    })

  const convenios: ConvenioSeed[] = CONVENIOS_DEMO.map((convenioDemo) => {
    const id = exigir(idPorCodigo.get(convenioDemo.codigo), 'Convenio sin id')
    return {
      id,
      codigo: convenioDemo.codigo,
      nombre: convenioDemo.nombre,
      version: convenioDemo.version,
      reglas: reglasInsertadas
        .filter((regla) => regla.convenioId === id)
        .map((regla) => ({
          id: regla.id,
          tipoHora: regla.tipoHora,
          factorBps: regla.factorBps,
          aplicaEn: regla.aplicaEn,
          topeDiarioMin: regla.topeDiarioMin,
          topeSemanalMin: regla.topeSemanalMin,
          requiereAutorizacion: regla.requiereAutorizacion,
          prioridad: regla.prioridad,
          activo: regla.activo,
        })),
    }
  })

  const porEmpleado = new Map<string, ConvenioSeed>()
  const filasAsignacion: { empleadoId: string; convenioId: string; desde: FechaIso }[] = []

  for (const empleado of empleados) {
    const codigo = convenioPorEmpleado(empleado.indice)
    if (!codigo) continue
    const convenioSeed = convenios.find((candidato) => candidato.codigo === codigo)
    if (!convenioSeed) continue
    porEmpleado.set(empleado.id, convenioSeed)
    filasAsignacion.push({ empleadoId: empleado.id, convenioId: convenioSeed.id, desde: inicioVigencia })
  }

  await tx.insert(empleadoConvenio).values(filasAsignacion)

  return { convenios, porEmpleado }
}

/* -------------------------------------------------------------------------- */
/* Tarifas de coste                                                           */
/* -------------------------------------------------------------------------- */

export async function sembrarTarifas(
  tx: Tx,
  empresaId: string,
  empleados: readonly EmpleadoSeed[],
  hoy: FechaIso,
): Promise<TarifaSeed[]> {
  return tx
    .insert(costeHora)
    .values(
      TARIFAS_DEMO.map((tarifa) => ({
        empresaId,
        empleadoId:
          tarifa.indiceEmpleado === null
            ? null
            : exigir(empleados[tarifa.indiceEmpleado], 'Empleado de tarifa inexistente').id,
        categoria: tarifa.categoria,
        importeHoraCents: tarifa.importeHoraCents,
        desde: sumarDias(hoy, tarifa.desdeDias),
        hasta: tarifa.hastaDias === null ? null : sumarDias(hoy, tarifa.hastaDias),
        activo: tarifa.activo,
      })),
    )
    .returning({
      id: costeHora.id,
      empleadoId: costeHora.empleadoId,
      categoria: costeHora.categoria,
      importeHoraCents: costeHora.importeHoraCents,
      desde: costeHora.desde,
      hasta: costeHora.hasta,
      activo: costeHora.activo,
    })
}

/* -------------------------------------------------------------------------- */
/* Ausencias                                                                  */
/* -------------------------------------------------------------------------- */

export type ResultadoAusencias = {
  tipos: number
  solicitudes: number
  saldos: number
}

export async function sembrarAusencias(
  tx: Tx,
  empresaId: string,
  empleados: readonly EmpleadoSeed[],
  semanaActual: SemanaIso,
  hoy: FechaIso,
  encargadoId: string,
  adminId: string,
): Promise<ResultadoAusencias> {
  const tiposInsertados = await tx
    .insert(tipoAusencia)
    .values(
      TIPOS_AUSENCIA_DEMO.map((tipo) => ({
        empresaId,
        codigo: tipo.codigo,
        nombre: tipo.nombre,
        computaSaldo: tipo.computaSaldo,
        requiereAprobacion: tipo.requiereAprobacion,
        activo: tipo.activo,
      })),
    )
    .returning({ id: tipoAusencia.id, codigo: tipoAusencia.codigo })

  const idPorCodigo = new Map(tiposInsertados.map((fila) => [fila.codigo, fila.id]))
  const lunes = semanaActual.weekStart

  const solicitudes = AUSENCIAS_DEMO.map((solicitud) => ({
    indiceEmpleado: solicitud.indiceEmpleado,
    codigoTipo: solicitud.codigoTipo,
    desde: sumarDias(lunes, solicitud.desdeDias),
    hasta: sumarDias(lunes, solicitud.hastaDias),
    minutos: solicitud.minutos,
    estado: solicitud.estado,
    motivoSolicitud: solicitud.motivoSolicitud,
    motivoResolucion: solicitud.motivoResolucion,
  }))

  const filasAusencia = solicitudes.map((solicitud) => {
    const empleado = exigir(empleados[solicitud.indiceEmpleado], 'Empleado de ausencia inexistente')
    const resuelta = solicitud.estado !== 'SOLICITADA'
    return {
      empresaId,
      empleadoId: empleado.id,
      tipoId: exigir(idPorCodigo.get(solicitud.codigoTipo), 'Tipo de ausencia inexistente'),
      desde: solicitud.desde,
      hasta: solicitud.hasta,
      minutos: solicitud.minutos,
      estado: solicitud.estado,
      motivoSolicitud: solicitud.motivoSolicitud,
      motivoResolucion: solicitud.motivoResolucion,
      resueltoPor: resuelta ? (solicitud.codigoTipo === 'PERMISO' ? adminId : encargadoId) : null,
      resueltoAt: resuelta ? fechaHora(sumarDias(solicitud.desde, -1), 10) : null,
      createdAt: fechaHora(sumarDias(solicitud.desde, -3), 9),
    }
  })

  await tx.insert(ausencia).values(filasAusencia)

  const anioActual = anioDe(hoy)
  const filasSaldo = empleados
    .filter((empleado) => empleado.activo)
    .map((empleado) => ({
      empleadoId: empleado.id,
      anio: anioActual,
      minutosAsignados: 10_800,
      minutosArrastrados: empleado.indice % 5 === 0 ? 480 : 0,
    }))

  await insertarEnLotes((lote) => tx.insert(saldoVacaciones).values(lote), filasSaldo)

  return {
    tipos: tiposInsertados.length,
    solicitudes: filasAusencia.length,
    saldos: filasSaldo.length,
  }
}

/* -------------------------------------------------------------------------- */
/* Cierres de periodo                                                         */
/* -------------------------------------------------------------------------- */

export type ResultadoCierres = {
  periodos: number
  partesBloqueados: number
}

type CierreDemo = {
  tipo: TipoPeriodo
  indiceEmpleado: number | null
  isoYear: number
  isoWeek: number
  anio: number
  mes: number | null
  desde: FechaIso
  hasta: FechaIso
  motivo: string
  reabierto: { fecha: FechaIso; motivo: string } | null
}

function claveCierre(cierre: { tipo: TipoPeriodo; desde: FechaIso; empleadoId: string | null }): string {
  return `${cierre.tipo}|${cierre.desde}|${cierre.empleadoId ?? ''}`
}

export async function sembrarCierres(
  tx: Tx,
  empresaId: string,
  empleados: readonly EmpleadoSeed[],
  semanaActual: SemanaIso,
  hoy: FechaIso,
  adminId: string,
  partes: readonly ParteSeed[],
): Promise<ResultadoCierres> {
  const semanaDesplazada = (desplazamiento: number): SemanaIso =>
    semanaIsoDe(sumarDias(semanaActual.weekStart, -7 * desplazamiento))

  const mesAnterior = (() => {
    const anio = anioDe(hoy)
    const mes = Number(hoy.slice(5, 7))
    return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
  })()
  const rangoMensual = rangoMes(mesAnterior.anio, mesAnterior.mes)
  const semanaIndividual = semanaDesplazada(4)
  const rangoIndividual = rangoSemana(semanaIndividual.isoYear, semanaIndividual.isoWeek)
  const semanaReabierta = semanaDesplazada(10)
  const rangoReabierta = rangoSemana(semanaReabierta.isoYear, semanaReabierta.isoWeek)

  const cierres: CierreDemo[] = [
    ...[12, 11].map((desplazamiento): CierreDemo => {
      const semana = semanaDesplazada(desplazamiento)
      const rango = rangoSemana(semana.isoYear, semana.isoWeek)
      return {
        tipo: 'SEMANAL',
        indiceEmpleado: null,
        isoYear: semana.isoYear,
        isoWeek: semana.isoWeek,
        anio: semana.isoYear,
        mes: null,
        desde: rango.desde,
        hasta: rango.hasta,
        motivo: 'Cierre semanal de nómina',
        reabierto: null,
      }
    }),
    {
      tipo: 'SEMANAL',
      indiceEmpleado: 18,
      isoYear: semanaIndividual.isoYear,
      isoWeek: semanaIndividual.isoWeek,
      anio: semanaIndividual.isoYear,
      mes: null,
      desde: rangoIndividual.desde,
      hasta: rangoIndividual.hasta,
      motivo: 'Cierre individual solicitado por el encargado',
      reabierto: null,
    },
    {
      tipo: 'MENSUAL',
      indiceEmpleado: 22,
      isoYear: 0,
      isoWeek: 0,
      anio: mesAnterior.anio,
      mes: mesAnterior.mes,
      desde: rangoMensual.desde,
      hasta: rangoMensual.hasta,
      motivo: 'Cierre mensual de nómina',
      reabierto: null,
    },
    {
      tipo: 'SEMANAL',
      indiceEmpleado: null,
      isoYear: semanaReabierta.isoYear,
      isoWeek: semanaReabierta.isoWeek,
      anio: semanaReabierta.isoYear,
      mes: null,
      desde: rangoReabierta.desde,
      hasta: rangoReabierta.hasta,
      motivo: 'Cierre semanal reabierto por corrección de horas',
      reabierto: {
        fecha: sumarDias(hoy, -56),
        motivo: 'Faltaban horas de dos operarios en el parte del martes',
      },
    },
  ]

  let partesBloqueados = 0
  const filasPeriodo: (typeof periodoCerrado.$inferInsert)[] = []
  const afectadosPorClave = new Map<string, readonly string[]>()

  for (const cierre of cierres) {
    const empleadoId =
      cierre.indiceEmpleado === null
        ? null
        : exigir(empleados[cierre.indiceEmpleado], 'Empleado de cierre inexistente').id

    const afectados = partes.filter((parteSeed) => {
      if (parteSeed.estado !== 'APROBADO') return false
      if (empleadoId !== null && parteSeed.empleadoId !== empleadoId) return false
      if (cierre.tipo === 'SEMANAL') {
        return parteSeed.isoYear === cierre.isoYear && parteSeed.isoWeek === cierre.isoWeek
      }
      return parteSeed.fechas.some((fecha) => cierre.desde <= fecha && fecha <= cierre.hasta)
    })

    afectadosPorClave.set(
      claveCierre({ tipo: cierre.tipo, desde: cierre.desde, empleadoId }),
      afectados.map((parteSeed) => parteSeed.id),
    )

    if (cierre.reabierto === null && afectados.length > 0) {
      for (const lote of enLotes(afectados.map((parteSeed) => parteSeed.id))) {
        await tx
          .update(parte)
          .set({ estado: 'BLOQUEADO', version: sql`${parte.version} + 1`, updatedAt: new Date() })
          .where(and(inArray(parte.id, lote), eq(parte.estado, 'APROBADO')))
      }
      partesBloqueados += afectados.length
    }

    filasPeriodo.push({
      empresaId,
      tipo: cierre.tipo,
      empleadoId,
      isoYear: cierre.tipo === 'SEMANAL' ? cierre.isoYear : null,
      isoWeek: cierre.tipo === 'SEMANAL' ? cierre.isoWeek : null,
      anio: cierre.anio,
      mes: cierre.mes,
      desde: cierre.desde,
      hasta: cierre.hasta,
      motivo: cierre.motivo,
      partesBloqueados: afectados.length,
      cerradoPor: adminId,
      reabiertoPor: cierre.reabierto === null ? null : adminId,
      reabiertoAt: cierre.reabierto === null ? null : fechaHora(cierre.reabierto.fecha, 11),
      motivoReapertura: cierre.reabierto?.motivo ?? null,
      createdAt: fechaHora(sumarDias(cierre.hasta, 1), 8),
    })
  }

  const insertados = await tx
    .insert(periodoCerrado)
    .values(filasPeriodo)
    .returning({
      id: periodoCerrado.id,
      tipo: periodoCerrado.tipo,
      desde: periodoCerrado.desde,
      empleadoId: periodoCerrado.empleadoId,
    })

  const auditoriaPeriodos = insertados.map((fila) => {
    const cierre = cierres.find(
      (candidato) =>
        claveCierre({ tipo: candidato.tipo, desde: candidato.desde, empleadoId: fila.empleadoId }) ===
        claveCierre(fila),
    )
    return {
      actorId: adminId,
      entidad: 'periodo_cerrado',
      entidadId: fila.id,
      accion: cierre?.reabierto === null ? 'CERRAR_PERIODO' : 'REABRIR_PERIODO',
      despues: {
        tipo: fila.tipo,
        desde: fila.desde,
        partesBloqueados: cierre?.reabierto === null ? partesBloqueados : 0,
      },
      motivo: cierre?.reabierto?.motivo ?? cierre?.motivo ?? null,
      createdAt: fechaHora(fila.desde, 8),
    }
  })
  if (auditoriaPeriodos.length > 0) await tx.insert(auditoria).values(auditoriaPeriodos)

  const auditoriaBloqueos: (typeof auditoria.$inferInsert)[] = []
  for (const fila of insertados) {
    const llave = claveCierre(fila)
    const afectados = afectadosPorClave.get(llave) ?? []
    const cierre = cierres.find(
      (candidato) =>
        claveCierre({ tipo: candidato.tipo, desde: candidato.desde, empleadoId: fila.empleadoId }) === llave,
    )
    if (cierre?.reabierto !== null) continue
    for (const parteId of afectados) {
      auditoriaBloqueos.push({
        actorId: adminId,
        entidad: 'parte',
        entidadId: parteId,
        accion: 'BLOQUEAR_PARTE',
        despues: { estado: 'BLOQUEADO', periodoId: fila.id },
        motivo: cierre?.motivo ?? null,
        createdAt: fechaHora(fila.desde, 8),
      })
    }
  }
  for (const lote of enLotes(auditoriaBloqueos, 400)) {
    if (lote.length > 0) await tx.insert(auditoria).values(lote)
  }

  return { periodos: insertados.length, partesBloqueados }
}

/* -------------------------------------------------------------------------- */
/* Presupuestos versionados                                                   */
/* -------------------------------------------------------------------------- */

export async function sembrarPresupuestos(
  tx: Tx,
  proyectos: readonly ProyectoSeed[],
  horasPorProyecto: ReadonlyMap<string, number>,
  gastoPorProyecto: ReadonlyMap<string, number>,
  adminId: string,
  hoy: FechaIso,
): Promise<number> {
  const filas: (typeof presupuestoProyecto.$inferInsert)[] = []

  for (const proyectoSeed of proyectos) {
    if (!proyectoSeed.activo) continue
    if (proyectoSeed.nivel === 'SIN_PRESUPUESTO') continue

    const horas = horasPorProyecto.get(proyectoSeed.id) ?? null
    const gasto = gastoPorProyecto.get(proyectoSeed.id) ?? 0
    const inicial = Math.max(120_000, Math.round(gasto * 0.6))
    const ampliado =
      proyectoSeed.nivel === 'AGOTADO'
        ? Math.max(80_000, Math.round(gasto * 0.8))
        : Math.max(220_000, Math.round(gasto * 1.15))

    filas.push({
      proyectoId: proyectoSeed.id,
      version: 1,
      importeCents: inicial,
      horasPresupuesto: horas === null ? null : Math.max(1, Math.round(horas * 0.9)),
      motivo: 'Presupuesto inicial aprobado',
      creadoPor: adminId,
      createdAt: fechaHora(sumarDias(hoy, -90), 9),
    })
    filas.push({
      proyectoId: proyectoSeed.id,
      version: 2,
      importeCents: ampliado,
      horasPresupuesto: horas,
      motivo:
        proyectoSeed.nivel === 'AGOTADO'
          ? 'Ajuste a la baja tras la revisión de costes'
          : 'Ampliación por trabajos adicionales',
      creadoPor: adminId,
      createdAt: fechaHora(sumarDias(hoy, -20), 9),
    })
  }

  if (filas.length > 0) await tx.insert(presupuestoProyecto).values(filas)
  return filas.length
}

/* -------------------------------------------------------------------------- */
/* Avisos in-app, correo y preferencias                                       */
/* -------------------------------------------------------------------------- */

export type UsuariosDemo = {
  admin: UsuarioSeed
  encargado: UsuarioSeed
  trabajador: UsuarioSeed
}

export async function sembrarAvisos(
  tx: Tx,
  empresaId: string,
  usuarios: UsuariosDemo,
  proyectos: readonly ProyectoSeed[],
  semanaActual: SemanaIso,
  hoy: FechaIso,
): Promise<number> {
  const filas: (typeof notificacion.$inferInsert)[] = []

  for (let desplazamiento = SEMANAS_DEMO - 1; desplazamiento >= 0; desplazamiento -= 1) {
    const semana = semanaIsoDe(sumarDias(semanaActual.weekStart, -7 * desplazamiento))
    filas.push({
      empresaId,
      usuarioId: usuarios.trabajador.id,
      tipo: 'RECORDATORIO_PARTE',
      titulo: 'Te queda el parte de esta semana',
      cuerpo: `La semana ${semana.isoWeek} de ${semana.isoYear} sigue pendiente de envío. Revisa tus horas antes del viernes.`,
      url: '/mi-semana',
      claveIdempotencia: claveRecordatorio(usuarios.trabajador.id, semana, 'manual', hoy),
      leidaAt: desplazamiento > 2 ? fechaHora(sumarDias(semana.weekStart, 5), 9) : null,
      createdAt: fechaHora(sumarDias(semana.weekStart, 4), 8),
    })
  }

  for (const [indice, proyectoSeed] of proyectos.slice(0, 8).entries()) {
    filas.push({
      empresaId,
      usuarioId: usuarios.trabajador.id,
      tipo: 'RIESGO_PROYECTO',
      titulo: `Riesgo en ${proyectoSeed.nombre}`,
      cuerpo: `El proyecto ${proyectoSeed.codigo} ha entrado en nivel ${proyectoSeed.nivel.toLowerCase()}. Revisa las horas imputadas.`,
      url: `/control/proyectos/${proyectoSeed.id}`,
      claveIdempotencia: claveRiesgoProyecto(
        usuarios.trabajador.id,
        proyectoSeed.id,
        proyectoSeed.nivel,
        hoy,
      ),
      leidaAt: indice % 2 === 0 ? fechaHora(sumarDias(hoy, -1), 10) : null,
      createdAt: fechaHora(sumarDias(hoy, -indice - 1), 7),
    })
  }

  for (let desplazamiento = 1; desplazamiento <= 5; desplazamiento += 1) {
    const semana = semanaIsoDe(sumarDias(semanaActual.weekStart, -7 * desplazamiento))
    filas.push({
      empresaId,
      usuarioId: usuarios.encargado.id,
      tipo: 'EQUIPO_PENDIENTE',
      titulo: `${3 + desplazamiento} partes esperan tu revisión`,
      cuerpo: `La semana ${semana.isoWeek} de ${semana.isoYear} tiene partes enviados sin aprobar.`,
      url: '/control/partes',
      claveIdempotencia: claveEquipoPendiente(usuarios.encargado.id, semana, 'manual', hoy),
      leidaAt: desplazamiento > 2 ? fechaHora(sumarDias(semana.weekStart, 6), 9) : null,
      createdAt: fechaHora(sumarDias(semana.weekStart, 5), 8),
    })
  }

  for (const [indice, proyectoSeed] of proyectos.slice(0, 4).entries()) {
    filas.push({
      empresaId,
      usuarioId: usuarios.encargado.id,
      tipo: 'RIESGO_PROYECTO',
      titulo: `Presupuesto comprometido en ${proyectoSeed.nombre}`,
      cuerpo: `El proyecto ${proyectoSeed.codigo} está en nivel ${proyectoSeed.nivel.toLowerCase()}.`,
      url: `/control/proyectos/${proyectoSeed.id}`,
      claveIdempotencia: claveRiesgoProyecto(
        usuarios.encargado.id,
        proyectoSeed.id,
        proyectoSeed.nivel,
        hoy,
      ),
      leidaAt: indice === 0 ? null : fechaHora(sumarDias(hoy, -2), 9),
      createdAt: fechaHora(sumarDias(hoy, -indice - 2), 8),
    })
  }

  for (const [indice, proyectoSeed] of proyectos.slice(2, 5).entries()) {
    filas.push({
      empresaId,
      usuarioId: usuarios.admin.id,
      tipo: 'RIESGO_PROYECTO',
      titulo: `Alerta de presupuesto: ${proyectoSeed.nombre}`,
      cuerpo: `Nivel ${proyectoSeed.nivel.toLowerCase()} en el proyecto ${proyectoSeed.codigo}. Hay que decidir ampliación o replanificación.`,
      url: `/control/proyectos/${proyectoSeed.id}`,
      claveIdempotencia: claveRiesgoProyecto(usuarios.admin.id, proyectoSeed.id, proyectoSeed.nivel, hoy),
      leidaAt: null,
      createdAt: fechaHora(sumarDias(hoy, -indice - 1), 7),
    })
  }

  await tx.insert(notificacion).values(filas)

  const preferencias: (typeof preferenciaAviso.$inferInsert)[] = [
    { usuarioId: usuarios.admin.id, tipo: 'RECORDATORIO_PARTE', email: false, inApp: true },
    { usuarioId: usuarios.admin.id, tipo: 'RIESGO_PROYECTO', email: true, inApp: true },
    { usuarioId: usuarios.encargado.id, tipo: 'EQUIPO_PENDIENTE', email: true, inApp: true },
    { usuarioId: usuarios.encargado.id, tipo: 'RECORDATORIO_PARTE', email: false, inApp: false },
    { usuarioId: usuarios.trabajador.id, tipo: 'RECORDATORIO_PARTE', email: true, inApp: true },
    { usuarioId: usuarios.trabajador.id, tipo: 'RIESGO_PROYECTO', email: false, inApp: true },
  ]
  await tx.insert(preferenciaAviso).values(preferencias)

  return filas.length + preferencias.length
}

export async function sembrarEmails(
  tx: Tx,
  empresaId: string,
  usuarios: UsuariosDemo,
  semanaActual: SemanaIso,
): Promise<number> {
  type EstadoDemo = 'PENDIENTE' | 'ENVIADO' | 'FALLIDO' | 'SIN_PROVEEDOR'
  type EmailDemo = {
    usuario: UsuarioSeed
    tipo: TipoNotificacion
    titulo: string
    cuerpo: string
    url: string | null
    estado: EstadoDemo
    clave: string
    desplazamiento: number
    intentos: number
    ultimoError: string | null
  }

  const plantillas: EmailDemo[] = [
    {
      usuario: usuarios.trabajador,
      tipo: 'RECORDATORIO_PARTE',
      titulo: 'Te queda el parte de esta semana',
      cuerpo: 'Aún no has enviado el parte de la semana en curso.',
      url: '/mi-semana',
      estado: 'ENVIADO',
      clave: 'recordatorio:demo-0',
      desplazamiento: 0,
      intentos: 1,
      ultimoError: null,
    },
    {
      usuario: usuarios.trabajador,
      tipo: 'RECORDATORIO_PARTE',
      titulo: 'Recordatorio de la semana anterior',
      cuerpo: 'La semana pasada quedó sin enviar y ya se ha enviado el recordatorio.',
      url: '/mi-semana',
      estado: 'ENVIADO',
      clave: 'recordatorio:demo-1',
      desplazamiento: 1,
      intentos: 1,
      ultimoError: null,
    },
    {
      usuario: usuarios.encargado,
      tipo: 'EQUIPO_PENDIENTE',
      titulo: 'Tienes partes pendientes de aprobar',
      cuerpo: 'Hay partes enviados esperando tu revisión en la bandeja de control.',
      url: '/control/partes',
      estado: 'ENVIADO',
      clave: 'equipo:demo-0',
      desplazamiento: 2,
      intentos: 1,
      ultimoError: null,
    },
    {
      usuario: usuarios.admin,
      tipo: 'RIESGO_PROYECTO',
      titulo: 'Alerta de presupuesto',
      cuerpo: 'Un proyecto ha superado el 100 % de las horas presupuestadas.',
      url: '/control/proyectos',
      estado: 'ENVIADO',
      clave: 'riesgo:demo-0',
      desplazamiento: 3,
      intentos: 2,
      ultimoError: null,
    },
    {
      usuario: usuarios.trabajador,
      tipo: 'RECORDATORIO_PARTE',
      titulo: 'Último aviso antes del cierre',
      cuerpo: 'El parte de esta semana se cierra el viernes a las 18:00.',
      url: '/mi-semana',
      estado: 'PENDIENTE',
      clave: 'recordatorio:demo-2',
      desplazamiento: 0,
      intentos: 0,
      ultimoError: null,
    },
    {
      usuario: usuarios.encargado,
      tipo: 'EQUIPO_PENDIENTE',
      titulo: 'Resumen del equipo',
      cuerpo: 'Resumen semanal de partes pendientes de revisión.',
      url: '/control/partes',
      estado: 'PENDIENTE',
      clave: 'equipo:demo-1',
      desplazamiento: 0,
      intentos: 0,
      ultimoError: null,
    },
    {
      usuario: usuarios.trabajador,
      tipo: 'RIESGO_PROYECTO',
      titulo: 'Riesgo en un proyecto',
      cuerpo: 'El proyecto en el que imputas horas está en nivel crítico.',
      url: '/control/proyectos',
      estado: 'FALLIDO',
      clave: 'riesgo:demo-1',
      desplazamiento: 1,
      intentos: 3,
      ultimoError: 'SMTP 421: servicio no disponible, se reintentará',
    },
    {
      usuario: usuarios.encargado,
      tipo: 'RECORDATORIO_PARTE',
      titulo: 'Recordatorio de tu propio parte',
      cuerpo: 'Tu parte de la semana sigue en borrador.',
      url: '/mi-semana',
      estado: 'FALLIDO',
      clave: 'recordatorio:demo-3',
      desplazamiento: 2,
      intentos: 2,
      ultimoError: '550 5.1.1 buzón inexistente',
    },
    {
      usuario: usuarios.admin,
      tipo: 'RIESGO_PROYECTO',
      titulo: 'Aviso de proyecto sin proveedor de correo',
      cuerpo: 'Este aviso quedó en cola porque no hay SMTP configurado.',
      url: '/control/proyectos',
      estado: 'SIN_PROVEEDOR',
      clave: 'riesgo:demo-2',
      desplazamiento: 0,
      intentos: 0,
      ultimoError: null,
    },
  ]

  const filas = plantillas.map((plantilla) => {
    const mensaje = construirEmail({
      tipo: plantilla.tipo,
      titulo: plantilla.titulo,
      cuerpo: plantilla.cuerpo,
      url: plantilla.url,
      appUrl: APP_URL,
      nombreDestinatario: plantilla.usuario.nombre,
    })
    const semana = semanaIsoDe(sumarDias(semanaActual.weekStart, -7 * plantilla.desplazamiento))

    return {
      empresaId,
      usuarioId: plantilla.usuario.id,
      tipo: plantilla.tipo,
      destinatario: plantilla.usuario.email,
      asunto: mensaje.asunto,
      cuerpo: mensaje.texto,
      plantilla: etiquetaPlantilla(plantilla.tipo),
      plantillaVersion: VERSION_PLANTILLAS,
      estado: plantilla.estado,
      claveIdempotencia: claveEmail(plantilla.tipo, plantilla.clave),
      intentos: plantilla.intentos,
      ultimoError: plantilla.ultimoError,
      enviadoAt:
        plantilla.estado === 'ENVIADO' ? fechaHora(sumarDias(semana.weekStart, 4), 8) : null,
      createdAt: fechaHora(sumarDias(semana.weekStart, 4), 7),
    }
  })

  await tx.insert(emailEnvio).values(filas)
  return filas.length
}

/* -------------------------------------------------------------------------- */
/* API pública y webhooks                                                     */
/* -------------------------------------------------------------------------- */

export type ResultadoIntegraciones = {
  claves: number
  webhooks: number
  entregas: number
}

export async function sembrarIntegraciones(
  tx: Tx,
  empresaId: string,
  adminId: string,
  partes: readonly ParteSeed[],
  hoy: FechaIso,
): Promise<ResultadoIntegraciones> {
  const claves = await tx
    .insert(apiKey)
    .values([
      {
        empresaId,
        nombre: 'Integración nómina (producción)',
        prefijo: 'demo0a1',
        hash: HASH_DEMO,
        alcances: ['lectura', 'escritura'],
        activo: true,
        caducaAt: new Date(Date.now() + 180 * 86_400_000),
        ultimoUsoAt: fechaHora(hoy, 6),
        createdAt: fechaHora(sumarDias(hoy, -120), 9),
      },
      {
        empresaId,
        nombre: 'Cuadro de mando (BI)',
        prefijo: 'demo0b2',
        hash: HASH_DEMO,
        alcances: ['lectura'],
        activo: true,
        caducaAt: new Date(Date.now() + 90 * 86_400_000),
        ultimoUsoAt: null,
        createdAt: fechaHora(sumarDias(hoy, -30), 9),
      },
      {
        empresaId,
        nombre: 'Script anterior (revocada)',
        prefijo: 'demo0c3',
        hash: HASH_DEMO,
        alcances: ['lectura'],
        activo: false,
        caducaAt: null,
        ultimoUsoAt: fechaHora(sumarDias(hoy, -45), 12),
        createdAt: fechaHora(sumarDias(hoy, -200), 9),
      },
      {
        empresaId,
        nombre: 'Prueba caducada',
        prefijo: 'demo0d4',
        hash: HASH_DEMO,
        alcances: ['lectura', 'escritura'],
        activo: true,
        caducaAt: new Date(Date.now() - 5 * 86_400_000),
        ultimoUsoAt: fechaHora(sumarDias(hoy, -10), 15),
        createdAt: fechaHora(sumarDias(hoy, -60), 9),
      },
    ])
    .returning({ id: apiKey.id })

  const claveActiva = exigir(claves[0], 'Sin clave de API activa')

  await tx.insert(apiIdempotencia).values([
    {
      apiKeyId: claveActiva.id,
      clave: 'idem-demo-0001',
      metodo: 'POST',
      ruta: '/api/v1/partes',
      respuesta: { id: exigir(partes[0], 'Sin partes para idempotencia').id, estado: 'BORRADOR' },
      createdAt: fechaHora(hoy, 6),
    },
    {
      apiKeyId: claveActiva.id,
      clave: 'idem-demo-0002',
      metodo: 'POST',
      ruta: '/api/v1/partes/:id/imputaciones',
      respuesta: { ok: true },
      createdAt: fechaHora(sumarDias(hoy, -1), 6),
    },
  ])

  const hooks = await tx
    .insert(webhook)
    .values([
      {
        empresaId,
        nombre: 'Nómina externa',
        url: 'https://hooks.example.com/levitec/nomina',
        secreto: 'a'.repeat(64),
        eventos: ['parte.aprobado', 'parte.bloqueado', 'periodo.cerrado', 'informe.completado'],
        activo: true,
      },
      {
        empresaId,
        nombre: 'Pruebas locales (inactivo)',
        url: 'http://localhost:4000/webhook',
        secreto: 'b'.repeat(64),
        eventos: ['parte.aprobado'],
        activo: false,
      },
    ])
    .returning({ id: webhook.id })

  const hookActivo = exigir(hooks[0], 'Sin webhook activo')
  const hookInactivo = exigir(hooks[1], 'Sin webhook inactivo')

  const partesOutbox = partes.slice(0, 5)
  const eventos = await tx
    .insert(outbox)
    .values(
      partesOutbox.map((parteSeed, indice) => ({
        empresaId,
        agregado: 'parte',
        agregadoId: parteSeed.id,
        evento: indice % 2 === 0 ? 'parte.aprobado' : 'parte.bloqueado',
        payload: {
          parteId: parteSeed.id,
          empleadoId: parteSeed.empleadoId,
          isoYear: parteSeed.isoYear,
          isoWeek: parteSeed.isoWeek,
          totalMinutos: parteSeed.totalMinutos,
        },
        procesadoAt: fechaHora(sumarDias(hoy, -indice - 1), 7),
        createdAt: fechaHora(sumarDias(hoy, -indice - 1), 6),
      })),
    )
    .returning({ id: outbox.id, evento: outbox.evento, payload: outbox.payload })

  const entregas = await tx
    .insert(webhookEntrega)
    .values([
      {
        webhookId: hookActivo.id,
        outboxId: exigir(eventos[0], 'Sin evento de outbox').id,
        evento: exigir(eventos[0], 'Sin evento de outbox').evento,
        payload: exigir(eventos[0], 'Sin evento de outbox').payload,
        estado: 'ENVIADO',
        intentos: 1,
        enviadoAt: fechaHora(sumarDias(hoy, -1), 7),
        createdAt: fechaHora(sumarDias(hoy, -1), 6),
      },
      {
        webhookId: hookActivo.id,
        outboxId: exigir(eventos[1], 'Sin evento de outbox').id,
        evento: exigir(eventos[1], 'Sin evento de outbox').evento,
        payload: exigir(eventos[1], 'Sin evento de outbox').payload,
        estado: 'PENDIENTE',
        intentos: 1,
        proximoIntentoAt: new Date(Date.now() + 3_600_000),
        createdAt: fechaHora(hoy, 6),
      },
      {
        webhookId: hookActivo.id,
        outboxId: exigir(eventos[2], 'Sin evento de outbox').id,
        evento: exigir(eventos[2], 'Sin evento de outbox').evento,
        payload: exigir(eventos[2], 'Sin evento de outbox').payload,
        estado: 'FALLIDO',
        intentos: 3,
        ultimoError: 'HTTP 502 Bad Gateway',
        proximoIntentoAt: new Date(Date.now() + 1_800_000),
        createdAt: fechaHora(sumarDias(hoy, -2), 6),
      },
      {
        webhookId: hookActivo.id,
        outboxId: exigir(eventos[3], 'Sin evento de outbox').id,
        evento: exigir(eventos[3], 'Sin evento de outbox').evento,
        payload: exigir(eventos[3], 'Sin evento de outbox').payload,
        estado: 'AGOTADO',
        intentos: 5,
        ultimoError: 'Connection timed out after 10s',
        createdAt: fechaHora(sumarDias(hoy, -3), 6),
      },
      {
        webhookId: hookInactivo.id,
        outboxId: exigir(eventos[4], 'Sin evento de outbox').id,
        evento: exigir(eventos[4], 'Sin evento de outbox').evento,
        payload: exigir(eventos[4], 'Sin evento de outbox').payload,
        estado: 'ENVIADO',
        intentos: 1,
        enviadoAt: fechaHora(sumarDias(hoy, -4), 7),
        createdAt: fechaHora(sumarDias(hoy, -4), 6),
      },
    ])
    .returning({ id: webhookEntrega.id })

  // El actor de la clave queda registrado para que la auditoría lo relacione.
  await tx.insert(auditoria).values({
    actorId: adminId,
    entidad: 'api_key',
    entidadId: claveActiva.id,
    accion: 'CREAR_CLAVE_API',
    despues: { nombre: 'Integración nómina (producción)', alcances: ['lectura', 'escritura'] },
    motivo: null,
    createdAt: fechaHora(sumarDias(hoy, -120), 9),
  })

  return { claves: claves.length, webhooks: hooks.length, entregas: entregas.length }
}

/* -------------------------------------------------------------------------- */
/* Informes                                                                   */
/* -------------------------------------------------------------------------- */

export type InformeCompletadoDemo =
  | {
      id: string
      tipo: 'CERTIFICACION_MENSUAL'
      formato: FormatoInforme
      parametros: { anio: number; mes: number }
    }
  | {
      id: string
      tipo: 'LIBRO_JORNADA' | 'AUSENCIAS'
      formato: FormatoInforme
      parametros: { desde: FechaIso; hasta: FechaIso }
    }

export async function sembrarInformes(
  tx: Tx,
  empresaId: string,
  adminId: string,
  hoy: FechaIso,
): Promise<{ total: number; pendientes: InformeCompletadoDemo[] }> {
  const anio = anioDe(hoy)
  const mes = Number(hoy.slice(5, 7))
  const mesAnterior = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
  const desdeSemana = sumarDias(hoy, -7)
  const desdeMes = sumarDias(hoy, -30)

  const filas: (typeof informe.$inferInsert)[] = [
    {
      empresaId,
      solicitanteId: adminId,
      tipo: 'CERTIFICACION_MENSUAL',
      formato: 'CSV',
      parametros: mesAnterior,
      estado: 'COMPLETADO',
      expiraAt: new Date(Date.now() + 86_400_000),
      createdAt: fechaHora(sumarDias(hoy, -1), 9),
    },
    {
      empresaId,
      solicitanteId: adminId,
      tipo: 'LIBRO_JORNADA',
      formato: 'XLSX',
      parametros: { desde: desdeSemana, hasta: hoy },
      estado: 'COMPLETADO',
      expiraAt: new Date(Date.now() + 86_400_000),
      createdAt: fechaHora(sumarDias(hoy, -1), 10),
    },
    {
      empresaId,
      solicitanteId: adminId,
      tipo: 'AUSENCIAS',
      formato: 'PDF',
      parametros: { desde: desdeMes, hasta: hoy },
      estado: 'COMPLETADO',
      expiraAt: new Date(Date.now() + 86_400_000),
      createdAt: fechaHora(sumarDias(hoy, -2), 9),
    },
    {
      empresaId,
      solicitanteId: adminId,
      tipo: 'HORAS_EXTRA',
      formato: 'CSV',
      parametros: { desde: desdeMes, hasta: hoy },
      estado: 'FALLIDO',
      error: 'El rango supera el máximo de 366 días permitido para el informe',
      expiraAt: new Date(Date.now() + 7_200_000),
      createdAt: fechaHora(sumarDias(hoy, -2), 11),
    },
    {
      empresaId,
      solicitanteId: adminId,
      tipo: 'AUDITORIA',
      formato: 'CSV',
      parametros: { desde: desdeMes, hasta: hoy },
      estado: 'PENDIENTE',
      jobId: 'demo-auditoria',
      expiraAt: new Date(Date.now() + 7_200_000),
      createdAt: fechaHora(hoy, 8),
    },
    {
      empresaId,
      solicitanteId: adminId,
      tipo: 'COSTES_PROYECTO',
      formato: 'XLSX',
      parametros: { desde: desdeMes, hasta: hoy, proyectoId: null },
      estado: 'EN_PROCESO',
      jobId: 'demo-costes',
      expiraAt: new Date(Date.now() + 7_200_000),
      createdAt: fechaHora(hoy, 9),
    },
  ]

  const insertados = await tx.insert(informe).values(filas).returning({ id: informe.id, tipo: informe.tipo })

  const pendientes: InformeCompletadoDemo[] = []
  for (const [indice, fila] of insertados.entries()) {
    if (indice === 0) {
      pendientes.push({
        id: fila.id,
        tipo: 'CERTIFICACION_MENSUAL',
        formato: 'CSV',
        parametros: mesAnterior,
      })
    }
    if (indice === 1) {
      pendientes.push({
        id: fila.id,
        tipo: 'LIBRO_JORNADA',
        formato: 'XLSX',
        parametros: { desde: desdeSemana, hasta: hoy },
      })
    }
    if (indice === 2) {
      pendientes.push({
        id: fila.id,
        tipo: 'AUSENCIAS',
        formato: 'PDF',
        parametros: { desde: desdeMes, hasta: hoy },
      })
    }
  }

  return { total: insertados.length, pendientes }
}

async function tablaDeInforme(demostracion: InformeCompletadoDemo, empresaId: string): Promise<TablaInforme> {
  if (demostracion.tipo === 'CERTIFICACION_MENSUAL') {
    return consultasInformes.certificacionMensual(
      empresaId,
      demostracion.parametros.anio,
      demostracion.parametros.mes,
    )
  }
  if (demostracion.tipo === 'LIBRO_JORNADA') {
    return consultasInformes.libroJornada(
      empresaId,
      demostracion.parametros.desde,
      demostracion.parametros.hasta,
    )
  }
  return consultasInformes.ausencias(
    empresaId,
    demostracion.parametros.desde,
    demostracion.parametros.hasta,
  )
}

/**
 * Genera el contenido real de los informes completados. Se ejecuta después de
 * confirmar la transacción: los informes leen datos ya visibles y, si el
 * exportador falla, el informe queda en FALLIDO sin romper la carga del demo.
 */
export async function completarInformesDemo(
  empresaId: string,
  pendientes: readonly InformeCompletadoDemo[],
): Promise<number> {
  let generados = 0

  for (const pendiente of pendientes) {
    try {
      const tabla = await tablaDeInforme(pendiente, empresaId)
      const contenido = await generarArchivo(tabla, pendiente.formato)
      await db
        .update(informe)
        .set({
          estado: 'COMPLETADO',
          nombreArchivo: nombreArchivoInforme(pendiente.tipo, pendiente.formato, `${Date.now()}`),
          contenido,
          tamanoBytes: contenido.byteLength,
          error: null,
          completadoAt: new Date(),
        })
        .where(eq(informe.id, pendiente.id))
      generados += 1
    } catch (error) {
      await db
        .update(informe)
        .set({ estado: 'FALLIDO', error: mensajeDeError(error) })
        .where(eq(informe.id, pendiente.id))
    }
  }

  return generados
}

/* -------------------------------------------------------------------------- */
/* Auditoría                                                                  */
/* -------------------------------------------------------------------------- */

export async function sembrarAuditoria(
  tx: Tx,
  usuarios: UsuariosDemo,
  partes: readonly ParteSeed[],
  convenios: readonly ConvenioSeed[],
  proyectos: readonly ProyectoSeed[],
  hoy: FechaIso,
): Promise<number> {
  type FilaAuditoria = typeof auditoria.$inferInsert
  const filas: FilaAuditoria[] = []

  const reciente = (fechaIso: FechaIso): boolean => Math.abs(diasEntre(fechaIso, hoy)) <= 28

  for (const parteSeed of partes) {
    if (!reciente(parteSeed.weekStart)) continue
    const autor = parteSeed.usuarioId
    const revisor = parteSeed.revisadoPor

    if (parteSeed.estado !== 'BORRADOR' && parteSeed.enviadoAt) {
      filas.push({
        actorId: autor,
        entidad: 'parte',
        entidadId: parteSeed.id,
        accion: 'ENVIAR_PARTE',
        despues: { estado: 'ENVIADO', totalMinutos: parteSeed.totalMinutos },
        motivo: null,
        createdAt: parteSeed.enviadoAt,
      })
    }

    if ((parteSeed.estado === 'APROBADO' || parteSeed.estado === 'BLOQUEADO') && parteSeed.revisadoAt) {
      filas.push({
        actorId: revisor,
        entidad: 'parte',
        entidadId: parteSeed.id,
        accion: 'APROBAR_PARTE',
        antes: { estado: 'ENVIADO' },
        despues: { estado: parteSeed.estado },
        motivo: null,
        createdAt: parteSeed.revisadoAt,
      })
    }

    if (parteSeed.estado === 'RECHAZADO' && parteSeed.revisadoAt) {
      filas.push({
        actorId: revisor,
        entidad: 'parte',
        entidadId: parteSeed.id,
        accion: 'RECHAZAR_PARTE',
        antes: { estado: 'ENVIADO' },
        despues: { estado: 'RECHAZADO' },
        motivo: parteSeed.motivoRechazo,
        createdAt: parteSeed.revisadoAt,
      })
    }
  }

  for (const [indice, usuario] of [usuarios.admin, usuarios.encargado, usuarios.trabajador].entries()) {
    for (let dia = 0; dia < 3; dia += 1) {
      filas.push({
        actorId: usuario.id,
        entidad: 'sesion',
        entidadId: usuario.id,
        accion: 'INICIAR_SESION',
        despues: { email: usuario.email },
        motivo: null,
        createdAt: fechaHora(sumarDias(hoy, -dia - indice), 7, 30),
      })
    }
  }

  for (const convenioSeed of convenios) {
    filas.push({
      actorId: usuarios.admin.id,
      entidad: 'convenio',
      entidadId: convenioSeed.id,
      accion: 'CREAR_CONVENIO',
      despues: { codigo: convenioSeed.codigo, version: convenioSeed.version },
      motivo: null,
      createdAt: fechaHora(sumarDias(hoy, -120), 10),
    })
  }

  for (const [indice, proyectoSeed] of proyectos.slice(0, 5).entries()) {
    filas.push({
      actorId: usuarios.admin.id,
      entidad: 'proyecto',
      entidadId: proyectoSeed.id,
      accion: 'CREAR_PROYECTO',
      despues: { codigo: proyectoSeed.codigo, nombre: proyectoSeed.nombre },
      motivo: null,
      createdAt: fechaHora(sumarDias(hoy, -100 + indice), 10),
    })
  }

  filas.push(
    {
      actorId: usuarios.admin.id,
      entidad: 'presupuesto_proyecto',
      entidadId: exigir(proyectos[0], 'Sin proyectos').id,
      accion: 'NUEVA_VERSION_PRESUPUESTO',
      antes: { version: 1 },
      despues: { version: 2, motivo: 'Ampliación por trabajos adicionales' },
      motivo: null,
      createdAt: fechaHora(sumarDias(hoy, -20), 9),
    },
    {
      actorId: usuarios.encargado.id,
      entidad: 'ausencia',
      entidadId: usuarios.encargado.id,
      accion: 'APROBAR_AUSENCIA',
      despues: { estado: 'APROBADA' },
      motivo: 'Aprobado: se recupera por la tarde',
      createdAt: fechaHora(sumarDias(hoy, -1), 10),
    },
    {
      actorId: null,
      entidad: 'sistema',
      entidadId: null,
      accion: 'RECORDATORIO_AUTOMATICO',
      despues: { usuariosNotificados: 27, ventana: 'viernes', origen: 'demo' },
      motivo: null,
      createdAt: fechaHora(sumarDias(hoy, -3), 17),
    },
    {
      actorId: null,
      entidad: 'sistema',
      entidadId: null,
      accion: 'INFORME_COMPLETADO',
      despues: { informesGenerados: 3, origen: 'demo' },
      motivo: null,
      createdAt: fechaHora(sumarDias(hoy, -2), 18),
    },
  )

  for (const lote of enLotes(filas, 400)) {
    if (lote.length > 0) await tx.insert(auditoria).values(lote)
  }

  return filas.length
}
