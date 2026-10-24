import { and, asc, desc, eq, exists, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { ausencia, empleado, saldoVacaciones, tipoAusencia, usuario } from '@/db/schema'
import type { EstadoAusencia } from '@/db/schema'
import { AppError } from '@/shared/errors'
import type {
  AusenciaListada,
  DatosSolicitud,
  DatosTipoAusencia,
  FiltrosAusencias,
  RepositorioAusencias,
  SaldoGuardado,
  TipoAusenciaResumen,
} from '../application/ports'

const columnasListado = {
  id: ausencia.id,
  empresaId: ausencia.empresaId,
  empleadoId: ausencia.empleadoId,
  empleadoNombre: empleado.nombre,
  empleadoCodigo: empleado.codigo,
  tipoId: ausencia.tipoId,
  tipoNombre: tipoAusencia.nombre,
  computaSaldo: tipoAusencia.computaSaldo,
  desde: ausencia.desde,
  hasta: ausencia.hasta,
  minutos: ausencia.minutos,
  estado: ausencia.estado,
  motivoSolicitud: ausencia.motivoSolicitud,
  motivoResolucion: ausencia.motivoResolucion,
  resueltoPorNombre: usuario.nombre,
  resueltoAt: ausencia.resueltoAt,
  createdAt: ausencia.createdAt,
}

function condicionSoloTrabajadores() {
  return exists(
    db
      .select({ uno: sql`1` })
      .from(usuario)
      .where(and(eq(usuario.empleadoId, ausencia.empleadoId), eq(usuario.rol, 'TRABAJADOR'))),
  )
}

export const repositorioAusencias: RepositorioAusencias = {
  async listarTipos(empresaId): Promise<TipoAusenciaResumen[]> {
    return db
      .select({
        id: tipoAusencia.id,
        empresaId: tipoAusencia.empresaId,
        codigo: tipoAusencia.codigo,
        nombre: tipoAusencia.nombre,
        computaSaldo: tipoAusencia.computaSaldo,
        requiereAprobacion: tipoAusencia.requiereAprobacion,
        activo: tipoAusencia.activo,
      })
      .from(tipoAusencia)
      .where(eq(tipoAusencia.empresaId, empresaId))
      .orderBy(desc(tipoAusencia.activo), asc(tipoAusencia.nombre))
  },

  async crearTipo(empresaId, datos: DatosTipoAusencia) {
    const filas = await db
      .insert(tipoAusencia)
      .values({ empresaId, ...datos })
      .onConflictDoNothing({ target: [tipoAusencia.empresaId, tipoAusencia.codigo] })
      .returning({ id: tipoAusencia.id })

    const creado = filas[0]
    if (!creado) {
      throw new AppError('VALIDACION', `Ya existe un tipo de ausencia con el código ${datos.codigo}`, {
        codigo: 'Código duplicado',
      })
    }
    return creado.id
  },

  async actualizarTipo(tipoId, datos) {
    await db.update(tipoAusencia).set(datos).where(eq(tipoAusencia.id, tipoId))
  },

  async alternarTipo(tipoId, activo) {
    await db.update(tipoAusencia).set({ activo }).where(eq(tipoAusencia.id, tipoId))
  },

  async obtenerTipo(tipoId) {
    const filas = await db
      .select({
        id: tipoAusencia.id,
        empresaId: tipoAusencia.empresaId,
        codigo: tipoAusencia.codigo,
        nombre: tipoAusencia.nombre,
        computaSaldo: tipoAusencia.computaSaldo,
        requiereAprobacion: tipoAusencia.requiereAprobacion,
        activo: tipoAusencia.activo,
      })
      .from(tipoAusencia)
      .where(eq(tipoAusencia.id, tipoId))
      .limit(1)

    return filas[0] ?? null
  },

  async listar(filtros: FiltrosAusencias): Promise<AusenciaListada[]> {
    const condiciones = [eq(ausencia.empresaId, filtros.empresaId)]
    if (filtros.empleadoId) condiciones.push(eq(ausencia.empleadoId, filtros.empleadoId))
    if (filtros.estado) condiciones.push(eq(ausencia.estado, filtros.estado))
    if (filtros.desde) condiciones.push(gte(ausencia.hasta, filtros.desde))
    if (filtros.hasta) condiciones.push(lte(ausencia.desde, filtros.hasta))
    if (filtros.soloTrabajadores) condiciones.push(condicionSoloTrabajadores())

    return db
      .select(columnasListado)
      .from(ausencia)
      .innerJoin(empleado, eq(empleado.id, ausencia.empleadoId))
      .innerJoin(tipoAusencia, eq(tipoAusencia.id, ausencia.tipoId))
      .leftJoin(usuario, eq(usuario.id, ausencia.resueltoPor))
      .where(and(...condiciones))
      .orderBy(desc(ausencia.desde), asc(empleado.nombre))
  },

  async obtener(ausenciaId) {
    const filas = await db
      .select(columnasListado)
      .from(ausencia)
      .innerJoin(empleado, eq(empleado.id, ausencia.empleadoId))
      .innerJoin(tipoAusencia, eq(tipoAusencia.id, ausencia.tipoId))
      .leftJoin(usuario, eq(usuario.id, ausencia.resueltoPor))
      .where(eq(ausencia.id, ausenciaId))
      .limit(1)

    return filas[0] ?? null
  },

  async crear(empresaId, empleadoId, datos: DatosSolicitud): Promise<string> {
    return db.transaction(async (tx) => {
      const vigentes = await tx
        .select({ id: ausencia.id })
        .from(ausencia)
        .where(
          and(
            eq(ausencia.empleadoId, empleadoId),
            inArray(ausencia.estado, ['SOLICITADA', 'APROBADA']),
            lte(ausencia.desde, datos.hasta),
            gte(ausencia.hasta, datos.desde),
          ),
        )
        .limit(1)

      if (vigentes.length > 0) {
        throw new AppError(
          'VALIDACION',
          'Ya hay una ausencia solicitada o aprobada que se solapa con esas fechas',
          { desde: 'Fechas solapadas' },
        )
      }

      const filas = await tx
        .insert(ausencia)
        .values({
          empresaId,
          empleadoId,
          tipoId: datos.tipoId,
          desde: datos.desde,
          hasta: datos.hasta,
          minutos: datos.minutos,
          motivoSolicitud: datos.motivo,
        })
        .returning({ id: ausencia.id })

      const creada = filas[0]
      if (!creada) throw new AppError('ERROR_INTERNO', 'No se pudo crear la ausencia')
      return creada.id
    })
  },

  async cambiarEstado(ausenciaId, esperado, nuevo, actorId, motivo) {
    await db.transaction(async (tx) => {
      const filas = await tx
        .select({ estado: ausencia.estado })
        .from(ausencia)
        .where(eq(ausencia.id, ausenciaId))
        .limit(1)
        .for('update')

      const actual = filas[0]
      if (!actual) throw new AppError('NO_ENCONTRADO', 'La ausencia no existe')
      if (actual.estado !== esperado) {
        throw new AppError('CONFLICTO_VERSION', 'La ausencia ha cambiado. Recarga y vuelve a intentarlo')
      }

      await tx
        .update(ausencia)
        .set({
          estado: nuevo,
          motivoResolucion: motivo,
          resueltoPor: actorId,
          resueltoAt: new Date(),
        })
        .where(eq(ausencia.id, ausenciaId))
    })
  },

  async aprobadasEnRango(empleadoId, desde, hasta) {
    return db
      .select({
        id: ausencia.id,
        empleadoId: ausencia.empleadoId,
        desde: ausencia.desde,
        hasta: ausencia.hasta,
        minutos: ausencia.minutos,
        estado: ausencia.estado,
        tipoId: ausencia.tipoId,
        tipoNombre: tipoAusencia.nombre,
      })
      .from(ausencia)
      .innerJoin(tipoAusencia, eq(tipoAusencia.id, ausencia.tipoId))
      .where(
        and(
          eq(ausencia.empleadoId, empleadoId),
          eq(ausencia.estado, 'APROBADA'),
          lte(ausencia.desde, hasta),
          gte(ausencia.hasta, desde),
        ),
      )
      .orderBy(asc(ausencia.desde))
  },

  async aprobadasDeEmpleado(empleadoId) {
    return db
      .select({
        id: ausencia.id,
        empleadoId: ausencia.empleadoId,
        desde: ausencia.desde,
        hasta: ausencia.hasta,
        minutos: ausencia.minutos,
        estado: ausencia.estado,
        tipoId: ausencia.tipoId,
        tipoNombre: tipoAusencia.nombre,
        computaSaldo: tipoAusencia.computaSaldo,
      })
      .from(ausencia)
      .innerJoin(tipoAusencia, eq(tipoAusencia.id, ausencia.tipoId))
      .where(and(eq(ausencia.empleadoId, empleadoId), eq(ausencia.estado, 'APROBADA')))
      .orderBy(asc(ausencia.desde))
  },

  async listarSaldos(empresaId, empleadoId): Promise<SaldoGuardado[]> {
    const condiciones = []
    if (empresaId) condiciones.push(eq(empleado.empresaId, empresaId))
    if (empleadoId) condiciones.push(eq(saldoVacaciones.empleadoId, empleadoId))

    return db
      .select({
        id: saldoVacaciones.id,
        empleadoId: saldoVacaciones.empleadoId,
        empleadoNombre: empleado.nombre,
        empleadoCodigo: empleado.codigo,
        anio: saldoVacaciones.anio,
        minutosAsignados: saldoVacaciones.minutosAsignados,
        minutosArrastrados: saldoVacaciones.minutosArrastrados,
      })
      .from(saldoVacaciones)
      .innerJoin(empleado, eq(empleado.id, saldoVacaciones.empleadoId))
      .where(condiciones.length > 0 ? and(...condiciones) : undefined)
      .orderBy(desc(saldoVacaciones.anio), asc(empleado.nombre))
  },

  async perteneceAEmpresa(empleadoId, empresaId) {
    const filas = await db
      .select({ id: empleado.id })
      .from(empleado)
      .where(and(eq(empleado.id, empleadoId), eq(empleado.empresaId, empresaId)))
      .limit(1)

    return filas.length > 0
  },

  async guardarSaldo(empleadoId, anio, minutosAsignados, minutosArrastrados) {
    await db
      .insert(saldoVacaciones)
      .values({ empleadoId, anio, minutosAsignados, minutosArrastrados })
      .onConflictDoUpdate({
        target: [saldoVacaciones.empleadoId, saldoVacaciones.anio],
        set: { minutosAsignados, minutosArrastrados },
      })
  },
}

export type { EstadoAusencia }
