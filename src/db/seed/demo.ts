import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  asignacion,
  auditoria,
  empleado,
  empresa,
  imputacion,
  parte,
  proyecto,
  tarea,
  usuario,
  usuarioProyecto,
} from '@/db/schema'
import type { EstadoParte } from '@/db/schema'
import { env } from '@/config/env'
import { hashPassword } from '@/modules/identidad/application/password'
import { hoyEnZona, semanaIsoDe, sumarDias, type FechaIso } from '@/modules/partes/domain/fechas'

export const CODIGO_EMPRESA_DEMO = 'DEMO'
export const DOMINIO_DEMO = '@demo.local'

export type ResumenDemo = {
  empresaId: string
  usuarios: number
  empleados: number
  proyectos: number
  tareas: number
  partes: number
  imputaciones: number
  semanas: number
}

const PROYECTOS_DEMO = [
  'Rehabilitación Edificio Colón',
  'Ampliación Nave Industrial Norte',
  'Urbanización Sector Residencial Sur',
  'Reforma Hotel Miramar',
  'Centro Comercial Las Fuentes',
  'Aparcamiento Subterráneo Plaza Mayor',
  'Colegio Público San Blas',
  'Rotonda de acceso Polígono Este',
  'Viviendas Unifamiliares La Vega',
  'Adecuación Local Comercial Centro',
]

const TAREAS_DEMO = [
  { codigo: 'T01', nombre: 'Jefatura de obra' },
  { codigo: 'T02', nombre: 'Ejecución obra' },
  { codigo: 'T03', nombre: 'Oficina técnica' },
  { codigo: 'T04', nombre: 'Remates y limpieza' },
]

const NOMBRES_TRABAJADORES = [
  'Álvaro Méndez', 'Rubén Castillo', 'Ismael Ortega', 'Jorge Villanueva', 'Sergio Quesada',
  'Marta Salazar', 'Lucía Ferreiro', 'Nuria Peña', 'Carmen Iglesias', 'Esther Oviedo',
  'Pablo Rueda', 'Andrés Maldonado', 'David Bermejo', 'Raúl Torralba', 'Víctor Sanchís',
  'Alberto Campo', 'Rubén Losada', 'Emilio Pardo', 'Fermín Barral', 'Gonzalo Rioja',
  'Alicia Terrón', 'Beatriz Vilar', 'Cristina Lamas', 'Diana Souto', 'Elena Fidalgo',
  'Fátima Amador', 'Gema Villar', 'Helena Carballo', 'Irene Castaño', 'Julia Mosquera',
  'Kevin Solís', 'Lorenzo Puente', 'Manuel Cañizares', 'Nicolás Arribas', 'Óscar Fábregas',
  'Patricia Segura', 'Quique Duran', 'Ramón Espada', 'Samuel Bonet', 'Tomás Verdugo',
  'Unai Echeverría', 'Valentín Rivas', 'Xavier Cortés',
]

const NOMBRES_ENCARGADOS = [
  'Fernando Nieto',
  'Rosario Alcaide',
  'Ignacio Peñalver',
  'Mercedes Ochoa',
  'Joaquín Valero',
  'Silvia Marchena',
]

/** Generador determinista: la misma carga produce siempre los mismos datos. */
function crearAleatorio(semilla: number) {
  let estado = semilla >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function enLotes<T>(items: readonly T[], tamano = 400): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < items.length; i += tamano) {
    lotes.push(items.slice(i, i + tamano))
  }
  return lotes
}

async function buscarEmpresaDemo(): Promise<string | null> {
  const filas = await db
    .select({ id: empresa.id })
    .from(empresa)
    .where(eq(empresa.codigo, CODIGO_EMPRESA_DEMO))
    .limit(1)

  return filas[0]?.id ?? null
}

export async function purgarDemo(): Promise<{ empresaId: string | null; partes: number; usuarios: number }> {
  const empresaId = await buscarEmpresaDemo()

  if (!empresaId) {
    return { empresaId: null, partes: 0, usuarios: 0 }
  }

  return db.transaction(async (tx) => {
    const partesDemo = await tx.select({ id: parte.id }).from(parte).where(eq(parte.empresaId, empresaId))
    const usuariosDemo = await tx.select({ id: usuario.id }).from(usuario).where(eq(usuario.empresaId, empresaId))
    const empleadosDemo = await tx.select({ id: empleado.id }).from(empleado).where(eq(empleado.empresaId, empresaId))

    const partesIds = partesDemo.map((p) => p.id)
    const usuariosIds = usuariosDemo.map((u) => u.id)
    const empleadosIds = empleadosDemo.map((e) => e.id)

    if (partesIds.length > 0) {
      await tx.delete(imputacion).where(inArray(imputacion.parteId, partesIds))
    }
    await tx.delete(parte).where(eq(parte.empresaId, empresaId))

    if (empleadosIds.length > 0) {
      await tx.delete(asignacion).where(inArray(asignacion.empleadoId, empleadosIds))
    }

    if (usuariosIds.length > 0) {
      await tx.delete(usuarioProyecto).where(inArray(usuarioProyecto.usuarioId, usuariosIds))
      await tx.delete(auditoria).where(inArray(auditoria.actorId, usuariosIds))
    }

    await tx.delete(usuario).where(eq(usuario.empresaId, empresaId))
    await tx.delete(empleado).where(eq(empleado.empresaId, empresaId))

    const proyectosDemo = await tx.select({ id: proyecto.id }).from(proyecto).where(eq(proyecto.empresaId, empresaId))
    if (proyectosDemo.length > 0) {
      await tx.delete(tarea).where(inArray(tarea.proyectoId, proyectosDemo.map((p) => p.id)))
    }
    await tx.delete(proyecto).where(eq(proyecto.empresaId, empresaId))
    await tx.delete(empresa).where(eq(empresa.id, empresaId))

    return { empresaId, partes: partesIds.length, usuarios: usuariosIds.length }
  })
}

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

  const aleatorio = crearAleatorio(20261022)
  const password = await hashPassword(env().DEMO_PASSWORD)
  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaActual = semanaIsoDe(hoy)

  const [empresaCreada] = await db
    .insert(empresa)
    .values({
      codigo: CODIGO_EMPRESA_DEMO,
      nombre: 'Levitec Demo',
      cif: 'B00000000',
      activa: true,
    })
    .returning({ id: empresa.id })

  if (!empresaCreada) throw new Error('No se pudo crear la empresa demo')
  const empresaId = empresaCreada.id

  const proyectosCreados = await db
    .insert(proyecto)
    .values(
      PROYECTOS_DEMO.map((nombre, indice) => ({
        empresaId,
        codigo: `DEMO-${String(indice + 1).padStart(2, '0')}`,
        nombre,
        horasPresupuesto: 1500 + indice * 250,
        activo: true,
      })),
    )
    .returning({ id: proyecto.id, codigo: proyecto.codigo })

  const tareasCreadas = await db
    .insert(tarea)
    .values(
      proyectosCreados.flatMap((proyectoFila, indiceProyecto) =>
        TAREAS_DEMO.map((tareaBase, indiceTarea) => ({
          proyectoId: proyectoFila.id,
          codigo: tareaBase.codigo,
          nombre: tareaBase.nombre,
          horasPresupuesto: 400 - indiceTarea * 50 + indiceProyecto * 10,
          activa: true,
        })),
      ),
    )
    .returning({ id: tarea.id, proyectoId: tarea.proyectoId, codigo: tarea.codigo })

  const totalEmpleados = 1 + NOMBRES_ENCARGADOS.length + NOMBRES_TRABAJADORES.length

  const nombreEmpleado = (indice: number): string => {
    if (indice === 0) return 'Administración Demo'
    if (indice <= NOMBRES_ENCARGADOS.length) return NOMBRES_ENCARGADOS[indice - 1] ?? 'Encargado'
    return NOMBRES_TRABAJADORES[indice - 1 - NOMBRES_ENCARGADOS.length] ?? 'Trabajador'
  }

  const empleadosCreados = await db
    .insert(empleado)
    .values(
      Array.from({ length: totalEmpleados }, (_, indice) => ({
        empresaId,
        codigo: `DEMO-${String(indice + 1).padStart(4, '0')}`,
        nombre: nombreEmpleado(indice),
        categoria: indice === 0 ? 'Administración' : indice <= NOMBRES_ENCARGADOS.length ? 'Encargado' : 'Oficial',
        activo: true,
      })),
    )
    .returning({ id: empleado.id, codigo: empleado.codigo, nombre: empleado.nombre })

  const filasUsuarios: {
    empresaId: string
    email: string
    passwordHash: string
    nombre: string
    rol: 'ADMIN' | 'ENCARGADO' | 'TRABAJADOR'
    empleadoId: string
    activo: boolean
  }[] = []

  const admin = empleadosCreados[0]
  if (!admin) throw new Error('No se pudo crear el empleado de administración')

  filasUsuarios.push({
    empresaId,
    email: `admin${DOMINIO_DEMO}`,
    passwordHash: password,
    nombre: 'Administración Demo',
    rol: 'ADMIN',
    empleadoId: admin.id,
    activo: true,
  })

  NOMBRES_ENCARGADOS.forEach((nombre, indice) => {
    const empleadoFila = empleadosCreados[indice + 1]
    if (!empleadoFila) return
    filasUsuarios.push({
      empresaId,
      email: `encargado${indice + 1}${DOMINIO_DEMO}`,
      passwordHash: password,
      nombre,
      rol: 'ENCARGADO',
      empleadoId: empleadoFila.id,
      activo: true,
    })
  })

  NOMBRES_TRABAJADORES.forEach((nombre, indice) => {
    const empleadoFila = empleadosCreados[indice + 1 + NOMBRES_ENCARGADOS.length]
    if (!empleadoFila) return
    filasUsuarios.push({
      empresaId,
      email: `trabajador${String(indice + 1).padStart(2, '0')}${DOMINIO_DEMO}`,
      passwordHash: password,
      nombre,
      rol: 'TRABAJADOR',
      empleadoId: empleadoFila.id,
      activo: true,
    })
  })

  const usuariosCreados = await db
    .insert(usuario)
    .values(filasUsuarios)
    .returning({ id: usuario.id, email: usuario.email, rol: usuario.rol, empleadoId: usuario.empleadoId })

  const encargados = usuariosCreados.filter((u) => u.rol === 'ENCARGADO')
  const trabajadores = usuariosCreados.filter((u) => u.rol === 'TRABAJADOR')

  const filasAlcance: { usuarioId: string; proyectoId: string }[] = []
  encargados.forEach((encargado, indice) => {
    const inicio = (indice * 2) % proyectosCreados.length
    const asignados = [0, 1, 2].map((desplazamiento) => proyectosCreados[(inicio + desplazamiento) % proyectosCreados.length])
    for (const proyectoFila of asignados) {
      if (!proyectoFila) continue
      filasAlcance.push({ usuarioId: encargado.id, proyectoId: proyectoFila.id })
    }
  })

  if (filasAlcance.length > 0) {
    await db.insert(usuarioProyecto).values(filasAlcance)
  }

  const tareasPorProyecto = new Map<string, string[]>()
  for (const tareaFila of tareasCreadas) {
    const lista = tareasPorProyecto.get(tareaFila.proyectoId) ?? []
    lista.push(tareaFila.id)
    tareasPorProyecto.set(tareaFila.proyectoId, lista)
  }

  const inicioAsignaciones = sumarDias(semanaActual.weekStart, -10 * 7)

  const filasAsignacion: {
    empleadoId: string
    tareaId: string
    desde: FechaIso
    hasta: FechaIso | null
    activa: boolean
  }[] = []

  const tareasPorEmpleado = new Map<string, string[]>()

  for (const [indice, usuarioFila] of trabajadores.entries()) {
    if (!usuarioFila.empleadoId) continue

    const indiceProyecto = indice % proyectosCreados.length
    const proyectoPrincipal = proyectosCreados[indiceProyecto]
    const proyectoSecundario = proyectosCreados[(indiceProyecto + 3) % proyectosCreados.length]
    if (!proyectoPrincipal) continue

    const tareasPrincipales = tareasPorProyecto.get(proyectoPrincipal.id) ?? []
    const tareasSecundarias = proyectoSecundario ? tareasPorProyecto.get(proyectoSecundario.id) ?? [] : []

    const seleccion = [...tareasPrincipales.slice(0, 2), ...tareasSecundarias.slice(0, 1)]
    tareasPorEmpleado.set(usuarioFila.id, seleccion)

    for (const tareaId of seleccion) {
      filasAsignacion.push({
        empleadoId: usuarioFila.empleadoId,
        tareaId,
        desde: inicioAsignaciones,
        hasta: null,
        activa: true,
      })
    }
  }

  if (filasAsignacion.length > 0) {
    await db.insert(asignacion).values(filasAsignacion)
  }

  // Encargados: también tienen tareas asignadas para poder probar su propia rejilla.
  const filasAsignacionEncargados = encargados.flatMap((encargado, indice) => {
    if (!encargado.empleadoId) return []
    const proyectoFila = proyectosCreados[indice % proyectosCreados.length]
    if (!proyectoFila) return []
    const tareas = (tareasPorProyecto.get(proyectoFila.id) ?? []).slice(0, 1)
    return tareas.map((tareaId) => ({
      empleadoId: encargado.empleadoId as string,
      tareaId,
      desde: inicioAsignaciones,
      hasta: null,
      activa: true,
    }))
  })

  if (filasAsignacionEncargados.length > 0) {
    await db.insert(asignacion).values(filasAsignacionEncargados)
  }

  const semanas = 6
  const partesGenerados: {
    empresaId: string
    empleadoId: string
    isoYear: number
    isoWeek: number
    weekStart: string
    estado: EstadoParte
    totalMinutos: number
    enviadoAt: Date | null
    revisadoPor: string | null
    revisadoAt: Date | null
    motivoRechazo: string | null
  }[] = []

  const imputacionesPorParte: { indiceParte: number; fecha: string; tareaId: string; minutos: number }[] = []

  const empleadosConAcceso = [...trabajadores, ...encargados].filter((u) => u.empleadoId)

  for (const usuarioFila of empleadosConAcceso) {
    if (!usuarioFila.empleadoId) continue
    const tareas = tareasPorEmpleado.get(usuarioFila.id) ?? []
    if (tareas.length === 0) continue

    for (let desplazamiento = semanas - 1; desplazamiento >= 0; desplazamiento -= 1) {
      const weekStart = sumarDias(semanaActual.weekStart, -desplazamiento * 7)
      const semana = semanaIsoDe(weekStart)

      const azarEstado = aleatorio()
      let estado: EstadoParte
      if (desplazamiento >= 2) estado = 'APROBADO'
      else if (desplazamiento === 1) estado = azarEstado < 0.75 ? 'ENVIADO' : 'APROBADO'
      else estado = azarEstado < 0.4 ? 'BORRADOR' : azarEstado < 0.8 ? 'ENVIADO' : azarEstado < 0.92 ? 'APROBADO' : 'RECHAZADO'

      const indiceParte = partesGenerados.length
      let totalParte = 0

      for (let dia = 0; dia < 5; dia += 1) {
        const fecha = sumarDias(weekStart, dia)
        if (desplazamiento === 0 && fecha > hoy) continue
        if (aleatorio() < 0.1) continue

        const base = dia === 4 ? 420 : 480
        const extra = aleatorio() < 0.18 ? 60 : 0
        const totalDia = base + extra

        const tareaPrincipal = tareas[0]
        if (!tareaPrincipal) continue

        const usaSegunda = tareas.length > 1 && aleatorio() < 0.3
        if (usaSegunda && tareas[1]) {
          const primera = 300
          const segunda = totalDia - primera
          imputacionesPorParte.push({ indiceParte, fecha, tareaId: tareaPrincipal, minutos: primera })
          imputacionesPorParte.push({ indiceParte, fecha, tareaId: tareas[1], minutos: segunda })
        } else {
          imputacionesPorParte.push({ indiceParte, fecha, tareaId: tareaPrincipal, minutos: totalDia })
        }

        totalParte += totalDia
      }

      if (totalParte === 0) {
        // Un parte vacío en borrador también es un caso real que conviene ver.
        estado = 'BORRADOR'
      }

      const revisor = encargados[partesGenerados.length % Math.max(encargados.length, 1)]
      const revisado = estado === 'APROBADO' || estado === 'RECHAZADO'

      partesGenerados.push({
        empresaId,
        empleadoId: usuarioFila.empleadoId,
        isoYear: semana.isoYear,
        isoWeek: semana.isoWeek,
        weekStart: semana.weekStart,
        estado,
        totalMinutos: totalParte,
        enviadoAt: estado === 'BORRADOR' ? null : new Date(`${weekStart}T08:00:00.000Z`),
        revisadoPor: revisado ? revisor?.id ?? null : null,
        revisadoAt: revisado ? new Date(`${sumarDias(weekStart, 7)}T09:00:00.000Z`) : null,
        motivoRechazo: estado === 'RECHAZADO' ? 'Faltan horas del jueves y la tarea no coincide con la asignación' : null,
      })
    }
  }

  let partesCreados = 0
  let imputacionesCreadas = 0

  for (const lote of enLotes(partesGenerados, 200)) {
    const insertados = await db
      .insert(parte)
      .values(lote)
      .onConflictDoNothing({ target: [parte.empleadoId, parte.isoYear, parte.isoWeek] })
      .returning({ id: parte.id })

    partesCreados += insertados.length
  }

  const todosLosPartes = await db
    .select({ id: parte.id, empleadoId: parte.empleadoId, isoYear: parte.isoYear, isoWeek: parte.isoWeek })
    .from(parte)
    .where(eq(parte.empresaId, empresaId))

  const mapaPartes = new Map<string, string>()
  for (const fila of todosLosPartes) {
    mapaPartes.set(`${fila.empleadoId}|${fila.isoYear}|${fila.isoWeek}`, fila.id)
  }

  const filasImputacion: { parteId: string; fecha: string; tareaId: string; minutos: number }[] = []
  const vistos = new Set<string>()

  for (const imputacionGenerada of imputacionesPorParte) {
    const parteGenerado = partesGenerados[imputacionGenerada.indiceParte]
    if (!parteGenerado) continue

    const parteId = mapaPartes.get(
      `${parteGenerado.empleadoId}|${parteGenerado.isoYear}|${parteGenerado.isoWeek}`,
    )
    if (!parteId) continue

    const llave = `${parteId}|${imputacionGenerada.fecha}|${imputacionGenerada.tareaId}`
    if (vistos.has(llave)) continue
    vistos.add(llave)

    if (imputacionGenerada.minutos <= 0) continue

    filasImputacion.push({
      parteId,
      fecha: imputacionGenerada.fecha,
      tareaId: imputacionGenerada.tareaId,
      minutos: imputacionGenerada.minutos,
    })
  }

  for (const lote of enLotes(filasImputacion, 500)) {
    const insertadas = await db.insert(imputacion).values(lote).onConflictDoNothing().returning({ id: imputacion.id })
    imputacionesCreadas += insertadas.length
  }

  return {
    empresaId,
    usuarios: usuariosCreados.length,
    empleados: empleadosCreados.length,
    proyectos: proyectosCreados.length,
    tareas: tareasCreadas.length,
    partes: partesCreados,
    imputaciones: imputacionesCreadas,
    semanas,
  }
}

export async function resumenDemo(): Promise<{ existe: boolean; usuarios: number; partes: number }> {
  const empresaId = await buscarEmpresaDemo()
  if (!empresaId) return { existe: false, usuarios: 0, partes: 0 }

  const usuariosDemo = await db
    .select({ id: usuario.id })
    .from(usuario)
    .where(and(eq(usuario.empresaId, empresaId)))

  const partesDemo = await db.select({ id: parte.id }).from(parte).where(eq(parte.empresaId, empresaId))

  return { existe: true, usuarios: usuariosDemo.length, partes: partesDemo.length }
}
