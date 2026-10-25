/**
 * Seed de la empresa de demostración.
 *
 * Genera un escenario completo y determinista: 14 semanas ISO, 50 empleados,
 * 11 proyectos de obra, el comodín de ajuste y todos los estados que la
 * interfaz sabe pintar. Los snapshots de jornada, cómputo y coste se calculan
 * con las funciones del dominio, así que una carga del demo equivale a un envío
 * y una aprobación reales.
 *
 * Todo el escenario vive en la empresa `DEMO` y se purga antes de recargar:
 * nunca toca datos de otras empresas.
 */

import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import type { Db } from '@/db/client'
import {
  apiIdempotencia,
  apiKey,
  apiRateLimit,
  asignacion,
  auditoria,
  ausencia,
  calendario,
  convenio,
  costeHora,
  costeImputacion,
  emailEnvio,
  empleado,
  empleadoCalendario,
  empleadoConvenio,
  empresa,
  excepcionCalendario,
  festivo,
  imputacion,
  informe,
  jornadaTeorica,
  notificacion,
  outbox,
  parte,
  periodoCerrado,
  preferenciaAviso,
  presupuestoProyecto,
  proyecto,
  reglaComputo,
  resultadoComputo,
  saldoVacaciones,
  tarea,
  tipoAusencia,
  usuario,
  usuarioProyecto,
  webhook,
  webhookEntrega,
} from '@/db/schema'
import { env } from '@/config/env'
import { CUENTAS_ACCESO_RAPIDO } from '@/modules/identidad/application/cuentas-demo'
import { emailCorporativo } from '@/modules/identidad/domain/email-corporativo'
import { hashPassword } from '@/modules/identidad/application/password'
import { computarSemana } from '@/modules/computo/domain/reglas'
import { calcularLinea } from '@/modules/coste/domain/coste'
import {
  hoyEnZona,
  semanaIsoDe,
  sumarDias,
  type FechaIso,
  type SemanaIso,
} from '@/modules/partes/domain/fechas'
import {
  AUSENCIAS_DEMO,
  CASOS,
  CODIGO_EMPRESA_DEMO,
  INDICE_PROYECTO_AJUSTE,
  MOTIVOS_RECHAZO,
  NOMBRE_ADMIN_DEMO,
  NOMBRE_ENCARGADO_DEMO,
  NOMBRE_TRABAJADOR_DEMO,
  NOMBRES_ENCARGADOS,
  PROYECTOS_DEMO,
  SEMANAS_DEMO,
  TAREAS_AJUSTE_DEMO,
  TAREAS_DEMO,
  TOTAL_EMPLEADOS_DEMO,
  capacidadSemanalDemo,
  categoriaEmpleadoDemo,
  convenioDeEmpleadoDemo,
  crearAleatorio,
  enLotes,
  esDiaFestivo,
  esDiaLaborable,
  estadoDeParte,
  exigir,
  motivoDesviacionDemo,
  nombreEmpleadoDemo,
  planDeRiesgo,
  rolEmpleadoDemo,
  sinParte,
  type AusenciaDemo,
  type CalendarioSeed,
  type ConvenioSeed,
  type EmpleadoSeed,
  type ParteSeed,
  type ProyectoSeed,
  type TarifaSeed,
  type TareaSeed,
  type UsuarioSeed,
} from './demo-datos'
import {
  calendarioDeEmpleado,
  completarInformesDemo,
  sembrarAuditoria,
  sembrarAusencias,
  sembrarAvisos,
  sembrarCalendarios,
  sembrarCierres,
  sembrarConvenios,
  sembrarEmails,
  sembrarInformes,
  sembrarIntegraciones,
  sembrarPresupuestos,
  sembrarTarifas,
  type UsuariosDemo,
} from './demo-fase2'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export { CODIGO_EMPRESA_DEMO }

export type ResumenDemo = {
  empresaId: string
  usuarios: number
  empleados: number
  proyectos: number
  tareas: number
  partes: number
  imputaciones: number
  semanas: number
  calendarios: number
  festivos: number
  convenios: number
  tarifas: number
  ausencias: number
  presupuestos: number
  cierres: number
  informes: number
  avisos: number
  correos: number
  clavesApi: number
  webhooks: number
  auditoria: number
}

async function buscarEmpresaDemo(): Promise<string | null> {
  const filas = await db
    .select({ id: empresa.id })
    .from(empresa)
    .where(eq(empresa.codigo, CODIGO_EMPRESA_DEMO))
    .limit(1)

  return filas[0]?.id ?? null
}

export type ResumenPurga = {
  empresaId: string | null
  partes: number
  usuarios: number
}

/**
 * Borra por completo la empresa DEMO respetando el orden de claves foráneas.
 * Las tablas hijas sin `empresa_id` se localizan por sus padres (`parteId`,
 * `empleadoId`, `convenioId`, `calendarioId`, `proyectoId` o `usuarioId`).
 */
export async function purgarDemo(): Promise<ResumenPurga> {
  const empresaId = await buscarEmpresaDemo()
  if (!empresaId) return { empresaId: null, partes: 0, usuarios: 0 }

  return db.transaction(async (tx) => {
    const partesDemo = await tx.select({ id: parte.id }).from(parte).where(eq(parte.empresaId, empresaId))
    const usuariosDemo = await tx.select({ id: usuario.id }).from(usuario).where(eq(usuario.empresaId, empresaId))
    const empleadosDemo = await tx.select({ id: empleado.id }).from(empleado).where(eq(empleado.empresaId, empresaId))
    const proyectosDemo = await tx.select({ id: proyecto.id }).from(proyecto).where(eq(proyecto.empresaId, empresaId))
    const conveniosDemo = await tx.select({ id: convenio.id }).from(convenio).where(eq(convenio.empresaId, empresaId))
    const calendariosDemo = await tx.select({ id: calendario.id }).from(calendario).where(eq(calendario.empresaId, empresaId))
    const clavesDemo = await tx.select({ id: apiKey.id }).from(apiKey).where(eq(apiKey.empresaId, empresaId))
    const webhooksDemo = await tx.select({ id: webhook.id }).from(webhook).where(eq(webhook.empresaId, empresaId))
    const informesDemo = await tx.select({ id: informe.id }).from(informe).where(eq(informe.empresaId, empresaId))

    const partesIds = partesDemo.map((fila) => fila.id)
    const usuariosIds = usuariosDemo.map((fila) => fila.id)
    const empleadosIds = empleadosDemo.map((fila) => fila.id)
    const proyectosIds = proyectosDemo.map((fila) => fila.id)
    const conveniosIds = conveniosDemo.map((fila) => fila.id)
    const calendariosIds = calendariosDemo.map((fila) => fila.id)
    const clavesIds = clavesDemo.map((fila) => fila.id)
    const webhooksIds = webhooksDemo.map((fila) => fila.id)

    if (webhooksIds.length > 0) {
      await tx.delete(webhookEntrega).where(inArray(webhookEntrega.webhookId, webhooksIds))
    }
    await tx.delete(webhook).where(eq(webhook.empresaId, empresaId))
    await tx.delete(outbox).where(eq(outbox.empresaId, empresaId))

    if (clavesIds.length > 0) {
      await tx.delete(apiRateLimit).where(inArray(apiRateLimit.apiKeyId, clavesIds))
      await tx.delete(apiIdempotencia).where(inArray(apiIdempotencia.apiKeyId, clavesIds))
    }
    await tx.delete(apiKey).where(eq(apiKey.empresaId, empresaId))

    await tx.delete(informe).where(eq(informe.empresaId, empresaId))
    await tx.delete(periodoCerrado).where(eq(periodoCerrado.empresaId, empresaId))

    if (partesIds.length > 0) {
      await tx.delete(costeImputacion).where(inArray(costeImputacion.parteId, partesIds))
      await tx.delete(resultadoComputo).where(inArray(resultadoComputo.parteId, partesIds))
    }
    if (empleadosIds.length > 0) {
      await tx.delete(costeImputacion).where(inArray(costeImputacion.empleadoId, empleadosIds))
    }
    await tx.delete(costeHora).where(eq(costeHora.empresaId, empresaId))

    await tx.delete(ausencia).where(eq(ausencia.empresaId, empresaId))
    await tx.delete(tipoAusencia).where(eq(tipoAusencia.empresaId, empresaId))

    if (empleadosIds.length > 0) {
      await tx.delete(saldoVacaciones).where(inArray(saldoVacaciones.empleadoId, empleadosIds))
      await tx.delete(empleadoConvenio).where(inArray(empleadoConvenio.empleadoId, empleadosIds))
    }
    if (conveniosIds.length > 0) {
      await tx.delete(reglaComputo).where(inArray(reglaComputo.convenioId, conveniosIds))
    }
    await tx.delete(convenio).where(eq(convenio.empresaId, empresaId))

    if (calendariosIds.length > 0) {
      await tx.delete(empleadoCalendario).where(inArray(empleadoCalendario.calendarioId, calendariosIds))
      await tx.delete(jornadaTeorica).where(inArray(jornadaTeorica.calendarioId, calendariosIds))
      await tx.delete(excepcionCalendario).where(inArray(excepcionCalendario.calendarioId, calendariosIds))
      await tx.delete(festivo).where(inArray(festivo.calendarioId, calendariosIds))
    }
    await tx.delete(calendario).where(eq(calendario.empresaId, empresaId))

    if (proyectosIds.length > 0) {
      await tx.delete(presupuestoProyecto).where(inArray(presupuestoProyecto.proyectoId, proyectosIds))
    }
    if (empleadosIds.length > 0) {
      await tx.delete(asignacion).where(inArray(asignacion.empleadoId, empleadosIds))
    }
    if (usuariosIds.length > 0) {
      await tx.delete(usuarioProyecto).where(inArray(usuarioProyecto.usuarioId, usuariosIds))
      await tx.delete(notificacion).where(inArray(notificacion.usuarioId, usuariosIds))
      await tx.delete(emailEnvio).where(inArray(emailEnvio.usuarioId, usuariosIds))
      await tx.delete(preferenciaAviso).where(inArray(preferenciaAviso.usuarioId, usuariosIds))
    }

    // Auditoría: por actor y por entidad. Cubre también los eventos de sistema
    // (actor nulo) que apuntan a entidades del demo.
    const idsEntidades = [
      ...partesIds,
      ...usuariosIds,
      ...empleadosIds,
      ...proyectosIds,
      ...conveniosIds,
      ...calendariosIds,
      ...clavesIds,
      ...webhooksIds,
      ...informesDemo.map((fila) => fila.id),
    ]
    const condicionesAuditoria = []
    if (usuariosIds.length > 0) condicionesAuditoria.push(inArray(auditoria.actorId, usuariosIds))
    if (idsEntidades.length > 0) condicionesAuditoria.push(inArray(auditoria.entidadId, idsEntidades))
    // Eventos de sistema del demo: no tienen actor ni entidad, se marcan al sembrarlos.
    condicionesAuditoria.push(and(eq(auditoria.entidad, 'sistema'), sql`${auditoria.despues}->>'origen' = 'demo'`))
    await tx.delete(auditoria).where(or(...condicionesAuditoria))

    if (partesIds.length > 0) {
      await tx.delete(imputacion).where(inArray(imputacion.parteId, partesIds))
    }
    await tx.delete(parte).where(eq(parte.empresaId, empresaId))
    await tx.delete(usuario).where(eq(usuario.empresaId, empresaId))
    await tx.delete(empleado).where(eq(empleado.empresaId, empresaId))

    if (proyectosIds.length > 0) {
      await tx.delete(tarea).where(inArray(tarea.proyectoId, proyectosIds))
    }
    await tx.delete(proyecto).where(eq(proyecto.empresaId, empresaId))
    await tx.delete(empresa).where(eq(empresa.id, empresaId))

    return { empresaId, partes: partesIds.length, usuarios: usuariosIds.length }
  })
}

/* -------------------------------------------------------------------------- */
/* Base: empresa, personas, proyectos                                         */
/* -------------------------------------------------------------------------- */

type BaseDemo = {
  empresaId: string
  empleados: EmpleadoSeed[]
  usuarios: UsuarioSeed[]
  destacados: UsuariosDemo
  encargados: UsuarioSeed[]
  proyectos: ProyectoSeed[]
  tareas: TareaSeed[]
  tareasPorEmpleado: Map<string, string[]>
}

async function sembrarBase(tx: Tx, semanaActual: SemanaIso): Promise<BaseDemo> {
  const [empresaCreada] = await tx
    .insert(empresa)
    .values({
      codigo: CODIGO_EMPRESA_DEMO,
      nombre: 'Levitec Demo',
      cif: 'B00000000',
      activa: true,
    })
    .returning({ id: empresa.id })

  const empresaId = exigir(empresaCreada?.id, 'No se pudo crear la empresa demo')
  const passwordHash = await hashPassword(env().DEMO_PASSWORD)

  const empleadosCreados = await tx
    .insert(empleado)
    .values(
      Array.from({ length: TOTAL_EMPLEADOS_DEMO }, (_, indice) => ({
        empresaId,
        codigo: `DEMO-${String(indice + 1).padStart(4, '0')}`,
        nombre: nombreEmpleadoDemo(indice),
        categoria: categoriaEmpleadoDemo(indice),
        activo: indice !== CASOS.indiceInactivo,
      })),
    )
    .returning({ id: empleado.id })

  const empleados: EmpleadoSeed[] = Array.from({ length: TOTAL_EMPLEADOS_DEMO }, (_, indice) => ({
    id: exigir(empleadosCreados[indice]?.id, 'Empleado sin id'),
    codigo: `DEMO-${String(indice + 1).padStart(4, '0')}`,
    nombre: nombreEmpleadoDemo(indice),
    indice,
    categoria: categoriaEmpleadoDemo(indice),
    activo: indice !== CASOS.indiceInactivo,
  }))

  const emailDestacadoPorNombre = new Map(
    CUENTAS_ACCESO_RAPIDO.map((cuenta) => [cuenta.nombre, cuenta.email]),
  )
  const emailsUsados = new Set<string>()
  const emailUnico = (nombre: string): string => {
    const email = emailDestacadoPorNombre.get(nombre) ?? emailCorporativo(nombre)
    if (emailsUsados.has(email)) {
      throw new Error(`Dos personas generan el mismo correo (${email}). Revisa los nombres del seed.`)
    }
    emailsUsados.add(email)
    return email
  }

  const filasUsuario = empleados.map((empleadoSeed) => ({
    empresaId,
    email: emailUnico(empleadoSeed.nombre),
    passwordHash,
    nombre: empleadoSeed.nombre,
    rol: rolEmpleadoDemo(empleadoSeed.indice),
    empleadoId: empleadoSeed.id,
    activo: empleadoSeed.activo,
  }))

  const usuariosCreados = await tx
    .insert(usuario)
    .values(filasUsuario)
    .returning({ id: usuario.id })

  const usuarios: UsuarioSeed[] = empleados.map((empleadoSeed, indice) => ({
    id: exigir(usuariosCreados[indice]?.id, 'Usuario sin id'),
    nombre: empleadoSeed.nombre,
    email: exigir(filasUsuario[indice]?.email, 'Usuario sin correo'),
    rol: rolEmpleadoDemo(empleadoSeed.indice),
    empleadoId: empleadoSeed.id,
    indiceEmpleado: empleadoSeed.indice,
    activo: empleadoSeed.activo,
  }))

  const admin = exigir(
    usuarios.find((candidato) => candidato.nombre === NOMBRE_ADMIN_DEMO),
    'Falta la cuenta de administración',
  )
  const encargado = exigir(
    usuarios.find((candidato) => candidato.nombre === NOMBRE_ENCARGADO_DEMO),
    'Falta la cuenta de encargado destacada',
  )
  const trabajador = exigir(
    usuarios.find((candidato) => candidato.nombre === NOMBRE_TRABAJADOR_DEMO),
    'Falta la cuenta de trabajador destacada',
  )
  const encargados = usuarios.filter((candidato) => candidato.rol === 'ENCARGADO')

  const proyectosCreados = await tx
    .insert(proyecto)
    .values(
      PROYECTOS_DEMO.map((proyectoDemo, indice) => ({
        empresaId,
        codigo: `DEMO-${String(indice + 1).padStart(2, '0')}`,
        nombre: proyectoDemo.nombre,
        esAjuste: proyectoDemo.esAjuste ?? false,
        activo: proyectoDemo.activo,
      })),
    )
    .returning({ id: proyecto.id })

  const proyectos: ProyectoSeed[] = PROYECTOS_DEMO.map((proyectoDemo, indice) => ({
    id: exigir(proyectosCreados[indice]?.id, 'Proyecto sin id'),
    codigo: `DEMO-${String(indice + 1).padStart(2, '0')}`,
    nombre: proyectoDemo.nombre,
    indice,
    activo: proyectoDemo.activo,
    nivel: proyectoDemo.nivel,
    esAjuste: proyectoDemo.esAjuste ?? false,
  }))

  const tareasCreadas = await tx
    .insert(tarea)
    .values(
      proyectos.flatMap((proyectoSeed) =>
        // El comodín no tiene presupuesto por tarea: su función es recoger
        // horas, no competir contra un objetivo.
        (proyectoSeed.esAjuste ? TAREAS_AJUSTE_DEMO : TAREAS_DEMO).map((tareaBase, indiceTarea) => ({
          proyectoId: proyectoSeed.id,
          codigo: tareaBase.codigo,
          nombre: tareaBase.nombre,
          horasPresupuesto: proyectoSeed.esAjuste ? null : 420 - indiceTarea * 60 + proyectoSeed.indice * 10,
          activa: true,
        })),
      ),
    )
    .returning({ id: tarea.id, proyectoId: tarea.proyectoId, codigo: tarea.codigo })

  const tareas: TareaSeed[] = tareasCreadas

  const tareasPorProyecto = new Map<string, string[]>()
  for (const tareaSeed of tareas) {
    const lista = tareasPorProyecto.get(tareaSeed.proyectoId) ?? []
    lista.push(tareaSeed.id)
    tareasPorProyecto.set(tareaSeed.proyectoId, lista)
  }

  const alcance = encargados.flatMap((usuarioFila, indice) => {
    const inicio = (indice * 2) % 10
    return [0, 1, 2].map((desplazamiento) => ({
      usuarioId: usuarioFila.id,
      proyectoId: exigir(proyectos[(inicio + desplazamiento) % 10], 'Proyecto de alcance inexistente').id,
    }))
  })
  // Sin alcance sobre el comodín, el parte de quien imputa horas de ajuste no
  // entra en la bandeja de su encargado y nadie puede aprobarlo.
  const proyectoAjuste = exigir(
    proyectos[INDICE_PROYECTO_AJUSTE],
    'Falta el proyecto de ajuste en el demo',
  )
  alcance.push(
    ...encargados.map((usuarioFila) => ({
      usuarioId: usuarioFila.id,
      proyectoId: proyectoAjuste.id,
    })),
  )
  if (alcance.length > 0) await tx.insert(usuarioProyecto).values(alcance)

  const inicioAsignaciones = sumarDias(semanaActual.weekStart, -7 * SEMANAS_DEMO)
  const filasAsignacion: {
    empleadoId: string
    tareaId: string
    desde: FechaIso
    hasta: FechaIso | null
    activa: boolean
  }[] = []
  const tareasPorEmpleado = new Map<string, string[]>()

  for (const empleadoSeed of empleados) {
    if (!empleadoSeed.activo) continue

    if (empleadoSeed.indice === 0) {
      const principal = tareasPorProyecto.get(exigir(proyectos[3], 'Proyecto inexistente').id) ?? []
      const tareaAdmin = principal[0]
      if (tareaAdmin) {
        tareasPorEmpleado.set(empleadoSeed.id, [tareaAdmin])
        filasAsignacion.push({
          empleadoId: empleadoSeed.id,
          tareaId: tareaAdmin,
          desde: inicioAsignaciones,
          hasta: null,
          activa: true,
        })
      }
      continue
    }

    if (empleadoSeed.indice <= NOMBRES_ENCARGADOS.length) {
      const proyectoEncargado = exigir(
        proyectos[(empleadoSeed.indice - 1) % 10],
        'Proyecto de encargado inexistente',
      )
      const tareaEncargado = (tareasPorProyecto.get(proyectoEncargado.id) ?? [])[0]
      if (tareaEncargado) {
        tareasPorEmpleado.set(empleadoSeed.id, [tareaEncargado])
        filasAsignacion.push({
          empleadoId: empleadoSeed.id,
          tareaId: tareaEncargado,
          desde: inicioAsignaciones,
          hasta: null,
          activa: true,
        })
      }
      continue
    }

    const indiceTrabajador = empleadoSeed.indice - 1 - NOMBRES_ENCARGADOS.length
    const indicePrincipal = indiceTrabajador % 10
    const indiceSecundario = (indicePrincipal + 3) % 10
    const principal = tareasPorProyecto.get(exigir(proyectos[indicePrincipal], 'Proyecto inexistente').id) ?? []
    const secundario = tareasPorProyecto.get(exigir(proyectos[indiceSecundario], 'Proyecto inexistente').id) ?? []

    // Uno de cada cuatro trabajadores imputa parte de su semana al comodín: el
    // dashboard debe mostrar la fila "Ajuste" con horas reales. La cuenta
    // destacada también lo tiene para poder enseñarlo en la rejilla.
    const tareaAjuste = (tareasPorProyecto.get(proyectoAjuste.id) ?? [])[0]
    const usaAjuste =
      indiceTrabajador % 4 === 1 || nombreEmpleadoDemo(empleadoSeed.indice) === NOMBRE_TRABAJADOR_DEMO
    const seleccion =
      tareaAjuste && usaAjuste
        ? [exigir(principal[0], 'Trabajador sin tarea principal'), tareaAjuste, ...principal.slice(1, 2)]
        : [...principal.slice(0, 2), ...secundario.slice(0, 1)]
    tareasPorEmpleado.set(empleadoSeed.id, seleccion)

    for (const tareaId of seleccion) {
      filasAsignacion.push({
        empleadoId: empleadoSeed.id,
        tareaId,
        desde: inicioAsignaciones,
        hasta: null,
        activa: true,
      })
    }

    // Asignaciones históricas cerradas: la pantalla de proyectos debe mostrar
    // también tareas que ya no están activas.
    if (indiceTrabajador % 7 === 3) {
      const historico = tareasPorProyecto.get(
        exigir(proyectos[(indicePrincipal + 5) % 10], 'Proyecto histórico inexistente').id,
      ) ?? []
      const tareaHistorica = historico[0]
      if (tareaHistorica) {
        filasAsignacion.push({
          empleadoId: empleadoSeed.id,
          tareaId: tareaHistorica,
          desde: sumarDias(inicioAsignaciones, -70),
          hasta: sumarDias(inicioAsignaciones, -14),
          activa: false,
        })
      }
    }
  }

  await tx.insert(asignacion).values(filasAsignacion)

  return {
    empresaId,
    empleados,
    usuarios,
    destacados: { admin, encargado, trabajador },
    encargados,
    proyectos,
    tareas,
    tareasPorEmpleado,
  }
}

/* -------------------------------------------------------------------------- */
/* Partes e imputaciones                                                      */
/* -------------------------------------------------------------------------- */

type ImputacionSeed = {
  id: string
  parteId: string
  fecha: FechaIso
  minutos: number
  tareaId: string
  proyectoId: string
}

type ResultadoPartes = {
  partes: ParteSeed[]
  imputaciones: ImputacionSeed[]
  consumoPorProyecto: Map<string, number>
}

type BorradorParte = {
  empleado: EmpleadoSeed
  usuario: UsuarioSeed
  semana: SemanaIso
  estado: ParteSeed['estado']
  lineas: { fecha: FechaIso; tareaId: string; minutos: number }[]
  totalMinutos: number
  /** Snapshot de jornada teórica; nulo en borradores y rechazados. */
  capacidadMin: number | null
  desviacionMin: number | null
  motivoDesviacion: string | null
  enviadoAt: Date | null
  revisadoPor: string | null
  revisadoAt: Date | null
  motivoRechazo: string | null
  version: number
  calendarioId: string | null
  calendarioVersion: number | null
}

async function sembrarPartes(
  tx: Tx,
  contexto: {
    empresaId: string
    hoy: FechaIso
    semanaActual: SemanaIso
    usuarios: readonly UsuarioSeed[]
    empleados: readonly EmpleadoSeed[]
    calendarios: readonly CalendarioSeed[]
    tareas: readonly TareaSeed[]
    tareasPorEmpleado: ReadonlyMap<string, readonly string[]>
    encargados: readonly UsuarioSeed[]
    destacados: UsuariosDemo
    aleatorio: () => number
  },
): Promise<ResultadoPartes> {
  const {
    empresaId,
    hoy,
    semanaActual,
    usuarios,
    empleados,
    calendarios,
    tareas,
    tareasPorEmpleado,
    encargados,
    destacados,
    aleatorio,
  } = contexto

  const proyectoDeTarea = new Map(tareas.map((tareaSeed) => [tareaSeed.id, tareaSeed.proyectoId]))
  const borradores: BorradorParte[] = []
  // Ausencias aprobadas del demo, en fechas absolutas. Se descuentan de las
  // imputaciones para que el parte no declare horas en días de vacaciones,
  // baja o permiso, igual que haría el propio trabajador al rellenar la rejilla.
  const ausenciasAprobadas = AUSENCIAS_DEMO.filter(
    (solicitud) => solicitud.estado === 'APROBADA',
  ).map((solicitud) => ({
    indiceEmpleado: solicitud.indiceEmpleado,
    desde: sumarDias(semanaActual.weekStart, solicitud.desdeDias),
    hasta: sumarDias(semanaActual.weekStart, solicitud.hastaDias),
    minutos: solicitud.minutos,
  }))

  for (const usuarioFila of usuarios) {
    if (!usuarioFila.activo) continue
    const empleadoSeed = empleados[usuarioFila.indiceEmpleado]
    if (!empleadoSeed) continue

    const tareasAsignadas = tareasPorEmpleado.get(empleadoSeed.id) ?? []
    if (tareasAsignadas.length === 0) continue

    const calendario = calendarioDeEmpleado(calendarios, empleadoSeed.indice)

    for (let desplazamiento = SEMANAS_DEMO - 1; desplazamiento >= 0; desplazamiento -= 1) {
      if (sinParte(empleadoSeed.indice, desplazamiento)) continue

      const weekStart = sumarDias(semanaActual.weekStart, -desplazamiento * 7)
      const semana = semanaIsoDe(weekStart)
      const estadoCalculado = estadoDeParte(usuarioFila.nombre, empleadoSeed.indice, desplazamiento)
      const vacio =
        empleadoSeed.indice === CASOS.indiceParteVacio && desplazamiento === CASOS.semanaParteVacio
      const estado = vacio ? 'BORRADOR' : estadoCalculado

      const sobrecarga =
        empleadoSeed.indice === CASOS.indiceSobrecarga &&
        CASOS.semanasSobrecarga.includes(desplazamiento)

      const lineas: BorradorParte['lineas'] = []

      if (!vacio) {
        for (let dia = 0; dia < 7; dia += 1) {
          const fecha = sumarDias(weekStart, dia)
          if (desplazamiento === 0 && fecha > hoy) continue
          if (!esDiaLaborable(calendario, fecha)) continue

          let minutos = sobrecarga ? 600 : dia === 4 ? 420 : 480
          if (sobrecarga && dia === 1) minutos = 740
          else if (!sobrecarga && aleatorio() < 0.15) minutos += 60

          const ausenciaDelDia = ausenciasAprobadas.find(
            (ausencia) =>
              ausencia.indiceEmpleado === empleadoSeed.indice &&
              ausencia.desde <= fecha &&
              fecha <= ausencia.hasta,
          )
          if (ausenciaDelDia) {
            // Jornada completa de ausencia: el día no lleva imputación.
            if (ausenciaDelDia.minutos === null) continue
            minutos = Math.max(0, minutos - ausenciaDelDia.minutos)
            if (minutos === 0) continue
          }

          const tareaPrincipal = exigir(tareasAsignadas[0], 'Empleado sin tarea principal')
          const tareaSecundaria = tareasAsignadas[1]

          if (tareaSecundaria && minutos > 330 && aleatorio() < 0.3) {
            lineas.push({ fecha, tareaId: tareaPrincipal, minutos: 300 })
            lineas.push({ fecha, tareaId: tareaSecundaria, minutos: minutos - 300 })
          } else {
            lineas.push({ fecha, tareaId: tareaPrincipal, minutos })
          }
        }

        // Un festivo trabajado: el motor aplicará la regla FESTIVA del convenio.
        if (
          empleadoSeed.indice === CASOS.indiceFestivoTrabajado &&
          desplazamiento === CASOS.semanaFestivoTrabajado
        ) {
          const diaFestivo = sumarDias(weekStart, 2)
          if (esDiaFestivo(calendario, diaFestivo)) {
            lineas.push({
              fecha: diaFestivo,
              tareaId: exigir(tareasAsignadas[0], 'Empleado sin tarea principal'),
              minutos: 240,
            })
          }
        }
      }

      // Sin líneas no hay parte: una semana entera de vacaciones o de baja se
      // muestra como SIN_PARTE, no como un parte aprobado de cero horas.
      if (!vacio && lineas.length === 0) continue

      const totalMinutos = lineas.reduce((total, linea) => total + linea.minutos, 0)
      const enviado = estado !== 'BORRADOR'
      const revisado = estado === 'APROBADO' || estado === 'RECHAZADO'

      // La capacidad y la desviación se congelan como lo haría el envío real.
      // Borrador y rechazado no declaran nada: se limpian al volver a editar.
      const ausenciasDelEmpleado: AusenciaDemo[] = ausenciasAprobadas
        .filter((ausencia) => ausencia.indiceEmpleado === empleadoSeed.indice)
        .map((ausencia) => ({
          desde: ausencia.desde,
          hasta: ausencia.hasta,
          minutos: ausencia.minutos,
        }))
      const capacidadSemana = capacidadSemanalDemo(
        calendario,
        weekStart,
        empleadoSeed.indice === CASOS.indiceJornadaParcial ? 240 : (calendario.horasDiariasMin ?? 480),
        ausenciasDelEmpleado,
      )
      const congelar = estado !== 'BORRADOR' && estado !== 'RECHAZADO'
      const capacidadMin = congelar ? capacidadSemana : null
      const desviacionMin = capacidadMin === null ? null : totalMinutos - capacidadMin
      const semanaCerrada = sumarDias(weekStart, 6) < hoy
      const motivoDesviacion =
        semanaCerrada && desviacionMin !== null && desviacionMin !== 0
          ? motivoDesviacionDemo(empleadoSeed.indice, desplazamiento, desviacionMin)
          : null

      const revisores = encargados.length > 0 ? encargados : [destacados.encargado]
      const revisor =
        usuarioFila.rol === 'TRABAJADOR'
          ? usuarioFila.nombre === NOMBRE_TRABAJADOR_DEMO
            ? destacados.encargado.id
            : exigir(
                revisores[(empleadoSeed.indice + desplazamiento) % revisores.length],
                'Sin encargado revisor',
              ).id
          : destacados.admin.id

      borradores.push({
        empleado: empleadoSeed,
        usuario: usuarioFila,
        semana,
        estado,
        lineas,
        totalMinutos,
        capacidadMin,
        desviacionMin,
        motivoDesviacion,
        enviadoAt: enviado ? new Date(`${sumarDias(weekStart, 4)}T16:00:00.000Z`) : null,
        revisadoPor: revisado ? revisor : null,
        revisadoAt: revisado ? new Date(`${sumarDias(weekStart, 7)}T09:00:00.000Z`) : null,
        motivoRechazo:
          estado === 'RECHAZADO'
            ? exigir(
                MOTIVOS_RECHAZO[(empleadoSeed.indice + desplazamiento) % MOTIVOS_RECHAZO.length],
                'Sin motivo de rechazo',
              )
            : null,
        version: estado === 'BORRADOR' ? 1 : revisado ? 3 : 2,
        calendarioId: enviado ? calendario.id : null,
        calendarioVersion: enviado ? calendario.version : null,
      })
    }
  }

  const insertados = await tx
    .insert(parte)
    .values(
      borradores.map((borrador) => ({
        empresaId,
        empleadoId: borrador.empleado.id,
        isoYear: borrador.semana.isoYear,
        isoWeek: borrador.semana.isoWeek,
        weekStart: borrador.semana.weekStart,
        estado: borrador.estado,
        totalMinutos: borrador.totalMinutos,
        capacidadMin: borrador.capacidadMin,
        desviacionMin: borrador.desviacionMin,
        motivoDesviacion: borrador.motivoDesviacion,
        version: borrador.version,
        calendarioId: borrador.calendarioId,
        calendarioVersion: borrador.calendarioVersion,
        enviadoAt: borrador.enviadoAt,
        revisadoPor: borrador.revisadoPor,
        revisadoAt: borrador.revisadoAt,
        motivoRechazo: borrador.motivoRechazo,
        createdAt: new Date(`${borrador.semana.weekStart}T06:00:00.000Z`),
        updatedAt: new Date(`${borrador.semana.weekStart}T06:00:00.000Z`),
      })),
    )
    .returning({ id: parte.id, empleadoId: parte.empleadoId, isoYear: parte.isoYear, isoWeek: parte.isoWeek })

  const idPorLlave = new Map(
    insertados.map((fila) => [`${fila.empleadoId}|${fila.isoYear}|${fila.isoWeek}`, fila.id]),
  )

  const partes: ParteSeed[] = []
  const filasImputacion: (typeof imputacion.$inferInsert)[] = []
  const consumoPorProyecto = new Map<string, number>()

  for (const borrador of borradores) {
    const llave = `${borrador.empleado.id}|${borrador.semana.isoYear}|${borrador.semana.isoWeek}`
    const parteId = idPorLlave.get(llave)
    if (!parteId) continue

    const fechas = [...new Set(borrador.lineas.map((linea) => linea.fecha))].sort()

    partes.push({
      id: parteId,
      empleadoId: borrador.empleado.id,
      indiceEmpleado: borrador.empleado.indice,
      usuarioId: borrador.usuario.id,
      rol: borrador.usuario.rol,
      estado: borrador.estado,
      isoYear: borrador.semana.isoYear,
      isoWeek: borrador.semana.isoWeek,
      weekStart: borrador.semana.weekStart,
      fechas,
      totalMinutos: borrador.totalMinutos,
      enviadoAt: borrador.enviadoAt,
      revisadoPor: borrador.revisadoPor,
      revisadoAt: borrador.revisadoAt,
      motivoRechazo: borrador.motivoRechazo,
      version: borrador.version,
    })

    const cuentaParaConsumo = borrador.estado === 'ENVIADO' || borrador.estado === 'APROBADO'

    for (const linea of borrador.lineas) {
      filasImputacion.push({
        parteId,
        fecha: linea.fecha,
        tareaId: linea.tareaId,
        minutos: linea.minutos,
      })
      const proyectoId = proyectoDeTarea.get(linea.tareaId)
      if (proyectoId && cuentaParaConsumo) {
        consumoPorProyecto.set(proyectoId, (consumoPorProyecto.get(proyectoId) ?? 0) + linea.minutos)
      }
    }
  }

  const imputacionesInsertadas: ImputacionSeed[] = []
  for (const lote of enLotes(filasImputacion, 500)) {
    if (lote.length === 0) continue
    const creadas = await tx.insert(imputacion).values(lote).returning({
      id: imputacion.id,
      parteId: imputacion.parteId,
      fecha: imputacion.fecha,
      minutos: imputacion.minutos,
      tareaId: imputacion.tareaId,
    })
    for (const fila of creadas) {
      imputacionesInsertadas.push({
        ...fila,
        proyectoId: exigir(proyectoDeTarea.get(fila.tareaId), 'Imputación sin proyecto'),
      })
    }
  }

  return { partes, imputaciones: imputacionesInsertadas, consumoPorProyecto }
}

/* -------------------------------------------------------------------------- */
/* Snapshots de cómputo y coste                                               */
/* -------------------------------------------------------------------------- */

type ResultadoSnapshots = {
  resultados: number
  costes: number
  gastoPorProyecto: Map<string, number>
}

async function sembrarSnapshots(
  tx: Tx,
  contexto: {
    partes: readonly ParteSeed[]
    imputaciones: readonly ImputacionSeed[]
    conveniosPorEmpleado: ReadonlyMap<string, ConvenioSeed>
    tarifas: readonly TarifaSeed[]
    empleados: readonly EmpleadoSeed[]
    calendarios: readonly CalendarioSeed[]
  },
): Promise<ResultadoSnapshots> {
  const { partes, imputaciones, conveniosPorEmpleado, tarifas, empleados, calendarios } = contexto

  const porParte = new Map<string, ImputacionSeed[]>()
  for (const linea of imputaciones) {
    const lista = porParte.get(linea.parteId) ?? []
    lista.push(linea)
    porParte.set(linea.parteId, lista)
  }

  const empleadoPorId = new Map(empleados.map((empleadoSeed) => [empleadoSeed.id, empleadoSeed]))
  const filasResultado: (typeof resultadoComputo.$inferInsert)[] = []
  const filasCoste: (typeof costeImputacion.$inferInsert)[] = []
  const gastoPorProyecto = new Map<string, number>()

  for (const parteSeed of partes) {
    if (parteSeed.estado !== 'APROBADO' && parteSeed.estado !== 'BLOQUEADO') continue

    const empleadoSeed = empleadoPorId.get(parteSeed.empleadoId)
    if (!empleadoSeed) continue

    const lineas = porParte.get(parteSeed.id) ?? []
    if (lineas.length === 0) continue

    const convenio = conveniosPorEmpleado.get(parteSeed.empleadoId) ?? null
    const calendario = calendarioDeEmpleado(calendarios, empleadoSeed.indice)

    const tramos = computarSemana(
      lineas.map((linea) => ({
        imputacionId: linea.id,
        fecha: linea.fecha,
        minutos: linea.minutos,
        esFestivo: esDiaFestivo(calendario, linea.fecha),
      })),
      convenio?.reglas ?? [],
    )

    for (const tramo of tramos) {
      filasResultado.push({
        parteId: parteSeed.id,
        imputacionId: tramo.imputacionId,
        tramo: tramo.tramo,
        tipoHora: tramo.tipoHora,
        minutosBase: tramo.minutosBase,
        factorBps: tramo.factorBps,
        minutosComputados: tramo.minutosComputados,
        requiereAutorizacion: tramo.requiereAutorizacion,
        reglaId: tramo.reglaId,
        convenioId: convenio?.id ?? null,
        convenioVersion: convenio?.version ?? null,
      })
    }

    const computados = new Map<string, number>()
    for (const tramo of tramos) {
      computados.set(tramo.imputacionId, (computados.get(tramo.imputacionId) ?? 0) + tramo.minutosComputados)
    }

    for (const linea of lineas) {
      const minutos = computados.get(linea.id) ?? linea.minutos
      if (minutos <= 0) continue

      const coste = calcularLinea(
        { fecha: linea.fecha, minutos },
        tarifas,
        { empleadoId: parteSeed.empleadoId, categoria: empleadoSeed.categoria },
      )

      filasCoste.push({
        parteId: parteSeed.id,
        imputacionId: linea.id,
        empleadoId: parteSeed.empleadoId,
        tareaId: linea.tareaId,
        proyectoId: linea.proyectoId,
        fecha: linea.fecha,
        minutos,
        costeHoraCents: coste.costeHoraCents,
        importeCents: coste.importeCents,
        sinTarifa: coste.sinTarifa,
        tarifaId: coste.tarifaId,
      })

      gastoPorProyecto.set(
        linea.proyectoId,
        (gastoPorProyecto.get(linea.proyectoId) ?? 0) + coste.importeCents,
      )
    }
  }

  for (const lote of enLotes(filasResultado, 500)) {
    if (lote.length > 0) await tx.insert(resultadoComputo).values(lote)
  }
  for (const lote of enLotes(filasCoste, 500)) {
    if (lote.length > 0) await tx.insert(costeImputacion).values(lote)
  }

  return {
    resultados: filasResultado.length,
    costes: filasCoste.length,
    gastoPorProyecto,
  }
}

/* -------------------------------------------------------------------------- */
/* Riesgo presupuestario y plazo                                              */
/* -------------------------------------------------------------------------- */

async function ajustarRiesgo(
  tx: Tx,
  proyectos: readonly ProyectoSeed[],
  consumoPorProyecto: ReadonlyMap<string, number>,
  hoy: FechaIso,
): Promise<Map<string, number>> {
  const horasPorProyecto = new Map<string, number>()

  for (const proyectoSeed of proyectos) {
    // El comodín no compite contra presupuesto ni plazo: sin fechas y sin horas.
    if (proyectoSeed.esAjuste) continue

    const minutos = consumoPorProyecto.get(proyectoSeed.id) ?? 0
    const plan = planDeRiesgo(proyectoSeed.nivel, minutos, hoy)

    await tx
      .update(proyecto)
      .set({
        horasPresupuesto: plan.horasPresupuesto,
        fechaInicio: plan.fechaInicio,
        fechaFin: plan.fechaFin,
      })
      .where(eq(proyecto.id, proyectoSeed.id))

    if (plan.horasPresupuesto !== null) horasPorProyecto.set(proyectoSeed.id, plan.horasPresupuesto)
  }

  return horasPorProyecto
}

/* -------------------------------------------------------------------------- */
/* Orquestación                                                               */
/* -------------------------------------------------------------------------- */

export async function cargarDemo(opciones: { refrescar?: boolean } = {}): Promise<ResumenDemo> {
  if (opciones.refrescar) {
    await purgarDemo()
  } else {
    const existente = await buscarEmpresaDemo()
    if (existente) {
      throw new Error(
        'La empresa DEMO ya existe. Usa "db:seed:demo --refresh" para recargarla, o purga antes de volver a cargar.',
      )
    }
  }

  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaActual = semanaIsoDe(hoy)
  const aleatorio = crearAleatorio(20261022)

  const { empresaId, informesPendientes } = await db.transaction(async (tx) => {
    const base = await sembrarBase(tx, semanaActual)

    const calendariosResultado = await sembrarCalendarios(
      tx,
      base.empresaId,
      semanaActual,
      hoy,
      base.empleados,
    )
    const conveniosResultado = await sembrarConvenios(
      tx,
      base.empresaId,
      base.empleados,
      hoy,
      convenioDeEmpleadoDemo,
    )
    const tarifas = await sembrarTarifas(tx, base.empresaId, base.empleados, hoy)

    const partesResultado = await sembrarPartes(tx, {
      empresaId: base.empresaId,
      hoy,
      semanaActual,
      usuarios: base.usuarios,
      empleados: base.empleados,
      calendarios: calendariosResultado.calendarios,
      tareas: base.tareas,
      tareasPorEmpleado: base.tareasPorEmpleado,
      encargados: base.encargados,
      destacados: base.destacados,
      aleatorio,
    })

    const cierres = await sembrarCierres(
      tx,
      base.empresaId,
      base.empleados,
      semanaActual,
      hoy,
      base.destacados.admin.id,
      partesResultado.partes,
    )

    const snapshots = await sembrarSnapshots(tx, {
      partes: partesResultado.partes,
      imputaciones: partesResultado.imputaciones,
      conveniosPorEmpleado: conveniosResultado.porEmpleado,
      tarifas,
      empleados: base.empleados,
      calendarios: calendariosResultado.calendarios,
    })

    const horasPorProyecto = await ajustarRiesgo(
      tx,
      base.proyectos,
      partesResultado.consumoPorProyecto,
      hoy,
    )

    const presupuestos = await sembrarPresupuestos(
      tx,
      base.proyectos,
      horasPorProyecto,
      snapshots.gastoPorProyecto,
      base.destacados.admin.id,
      hoy,
    )

    const ausencias = await sembrarAusencias(
      tx,
      base.empresaId,
      base.empleados,
      semanaActual,
      hoy,
      base.destacados.encargado.id,
      base.destacados.admin.id,
    )

    const avisos = await sembrarAvisos(
      tx,
      base.empresaId,
      base.destacados,
      base.proyectos,
      semanaActual,
      hoy,
    )
    const correos = await sembrarEmails(tx, base.empresaId, base.destacados, semanaActual)
    const integraciones = await sembrarIntegraciones(
      tx,
      base.empresaId,
      base.destacados.admin.id,
      partesResultado.partes,
      hoy,
    )
    const informesDemo = await sembrarInformes(
      tx,
      base.empresaId,
      base.destacados.admin.id,
      hoy,
    )
    const eventosAuditoria = await sembrarAuditoria(
      tx,
      base.destacados,
      partesResultado.partes,
      conveniosResultado.convenios,
      base.proyectos,
      hoy,
    )

    return {
      empresaId: base.empresaId,
      informesPendientes: {
        pendientes: informesDemo.pendientes,
        resumen: {
          empresaId: base.empresaId,
          usuarios: base.usuarios.length,
          empleados: base.empleados.length,
          proyectos: base.proyectos.length,
          tareas: base.tareas.length,
          partes: partesResultado.partes.length,
          imputaciones: partesResultado.imputaciones.length,
          semanas: SEMANAS_DEMO,
          calendarios: calendariosResultado.calendarios.length,
          festivos: calendariosResultado.festivos,
          convenios: conveniosResultado.convenios.length,
          tarifas: tarifas.length,
          ausencias: ausencias.solicitudes,
          presupuestos,
          cierres: cierres.periodos,
          informes: informesDemo.total,
          avisos,
          correos,
          clavesApi: integraciones.claves,
          webhooks: integraciones.webhooks,
          auditoria: eventosAuditoria,
        } satisfies ResumenDemo,
      },
    }
  })

  await completarInformesDemo(empresaId, informesPendientes.pendientes)

  return informesPendientes.resumen
}

export async function resumenDemo(): Promise<{
  existe: boolean
  usuarios: number
  partes: number
  informes: number
  cierres: number
}> {
  const empresaId = await buscarEmpresaDemo()
  if (!empresaId) return { existe: false, usuarios: 0, partes: 0, informes: 0, cierres: 0 }

  const [usuariosDemo, partesDemo, informesDemo, cierresDemo] = await Promise.all([
    db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.empresaId, empresaId))),
    db.select({ id: parte.id }).from(parte).where(eq(parte.empresaId, empresaId)),
    db.select({ id: informe.id }).from(informe).where(eq(informe.empresaId, empresaId)),
    db.select({ id: periodoCerrado.id }).from(periodoCerrado).where(eq(periodoCerrado.empresaId, empresaId)),
  ])

  return {
    existe: true,
    usuarios: usuariosDemo.length,
    partes: partesDemo.length,
    informes: informesDemo.length,
    cierres: cierresDemo.length,
  }
}
