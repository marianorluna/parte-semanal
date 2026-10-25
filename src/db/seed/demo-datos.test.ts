import { claveEmail } from '@/modules/email/domain/email'
import {
  claveEquipoPendiente,
  claveRecordatorio,
  claveRiesgoProyecto,
} from '@/modules/notificaciones/domain/claves'
import { semanaIsoDe, sumarDias } from '@/modules/partes/domain/fechas'
import { evaluarRiesgo, type NivelRiesgo } from '@/modules/reporting/domain/riesgo'
import {
  AUSENCIAS_DEMO,
  NOMBRE_ADMIN_DEMO,
  NOMBRE_ENCARGADO_DEMO,
  NOMBRE_TRABAJADOR_DEMO,
  SEMANAS_DEMO,
  TOTAL_EMPLEADOS_DEMO,
  estadoDeParte,
  nombreEmpleadoDemo,
  planDeRiesgo,
} from './demo-datos'

const HOY = '2026-10-24'
const SEMANA_ACTUAL = semanaIsoDe(HOY)
const PROYECTOS = Array.from({ length: 8 }, (_, indice) => `proyecto-${indice}`)

/** Estados de la semana actual (`0`) y la anterior (`1`) para toda la plantilla. */
function matrizEstadosSemanasRecientes(): string[][] {
  return [0, 1].map((desplazamiento) =>
    Array.from({ length: TOTAL_EMPLEADOS_DEMO }, (_, indice) =>
      estadoDeParte(nombreEmpleadoDemo(indice), indice, desplazamiento),
    ),
  )
}

describe('matriz de estados del demo', () => {
  it('es determinista', () => {
    expect(matrizEstadosSemanasRecientes()).toEqual(matrizEstadosSemanasRecientes())
  })

  it('cubre los cinco estados entre las dos semanas recientes y los cierres', () => {
    const [semanaActual, semanaAnterior] = matrizEstadosSemanasRecientes()
    const visibles = new Set([...(semanaActual ?? []), ...(semanaAnterior ?? []), 'BLOQUEADO'])

    expect(visibles).toEqual(new Set(['BORRADOR', 'ENVIADO', 'RECHAZADO', 'APROBADO', 'BLOQUEADO']))
    expect(new Set(semanaActual)).toEqual(new Set(['BORRADOR', 'ENVIADO', 'RECHAZADO', 'APROBADO']))
    expect(new Set(semanaAnterior)).toEqual(new Set(['BORRADOR', 'ENVIADO', 'RECHAZADO', 'APROBADO']))
  })

  it('deja en APROBADO las semanas que cierran toda la empresa', () => {
    for (const desplazamiento of [11, 12]) {
      const estados = new Set(
        Array.from({ length: TOTAL_EMPLEADOS_DEMO }, (_, indice) =>
          estadoDeParte(nombreEmpleadoDemo(indice), indice, desplazamiento),
        ),
      )

      expect(estados).toEqual(new Set(['APROBADO']))
    }
  })

  it('fuerza los casos de las cuentas destacadas', () => {
    const indiceDe = (nombre: string): number =>
      Array.from({ length: TOTAL_EMPLEADOS_DEMO }, (_, indice) => nombreEmpleadoDemo(indice)).indexOf(nombre)

    const trabajador = indiceDe(NOMBRE_TRABAJADOR_DEMO)
    const encargado = indiceDe(NOMBRE_ENCARGADO_DEMO)
    const admin = indiceDe(NOMBRE_ADMIN_DEMO)

    expect(estadoDeParte(NOMBRE_TRABAJADOR_DEMO, trabajador, 0)).toBe('BORRADOR')
    expect(estadoDeParte(NOMBRE_TRABAJADOR_DEMO, trabajador, 1)).toBe('RECHAZADO')
    expect(estadoDeParte(NOMBRE_TRABAJADOR_DEMO, trabajador, 2)).toBe('ENVIADO')
    expect(estadoDeParte(NOMBRE_TRABAJADOR_DEMO, trabajador, 3)).toBe('APROBADO')
    expect(estadoDeParte(NOMBRE_ENCARGADO_DEMO, encargado, 2)).toBe('RECHAZADO')
    expect(estadoDeParte(NOMBRE_ADMIN_DEMO, admin, 1)).toBe('ENVIADO')
  })
})

describe('ausencias del demo', () => {
  it('cubre los cuatro estados con rangos de fecha coherentes', () => {
    const estados = new Set(AUSENCIAS_DEMO.map((solicitud) => solicitud.estado))
    expect(estados).toEqual(new Set(['SOLICITADA', 'APROBADA', 'RECHAZADA', 'ANULADA']))

    for (const solicitud of AUSENCIAS_DEMO) {
      expect(solicitud.desdeDias).toBeLessThanOrEqual(solicitud.hastaDias)
      expect(solicitud.indiceEmpleado).toBeGreaterThanOrEqual(0)
      expect(solicitud.indiceEmpleado).toBeLessThan(TOTAL_EMPLEADOS_DEMO)
      if (solicitud.minutos !== null) {
        expect(solicitud.minutos).toBeGreaterThan(0)
        expect(solicitud.minutos).toBeLessThanOrEqual(24 * 60)
      }
      expect(solicitud.motivoSolicitud.length).toBeGreaterThan(0)
      if (solicitud.estado === 'SOLICITADA') expect(solicitud.motivoResolucion).toBeNull()
      else expect(solicitud.motivoResolucion).not.toBeNull()
    }
  })

  it('descuenta una ausencia parcial aprobada de la semana actual del trabajador destacado', () => {
    const parcial = AUSENCIAS_DEMO.find(
      (solicitud) => solicitud.estado === 'APROBADA' && solicitud.minutos !== null && solicitud.desdeDias >= 0,
    )
    expect(parcial).toBeDefined()
    expect(parcial?.indiceEmpleado).toBe(7)
    expect(parcial?.desdeDias).toBe(parcial?.hastaDias)
    expect(sumarDias(SEMANA_ACTUAL.weekStart, parcial?.desdeDias ?? 0)).toBe(
      sumarDias(SEMANA_ACTUAL.weekStart, 2),
    )
  })
})

describe('planDeRiesgo', () => {
  const NIVELES: readonly NivelRiesgo[] = [
    'OK',
    'AVISO',
    'CRITICO',
    'AGOTADO',
    'SIN_PRESUPUESTO',
    'SIN_PLAZO',
  ]
  const MINUTOS_CONSUMIDOS = 80 * 60

  it.each(NIVELES)('ajusta presupuesto y plazo para dejar el proyecto en %s', (nivel) => {
    const plan = planDeRiesgo(nivel, MINUTOS_CONSUMIDOS, HOY)

    const riesgo = evaluarRiesgo({
      minutosConsumidos: MINUTOS_CONSUMIDOS,
      horasPresupuesto: plan.horasPresupuesto,
      fechaInicio: plan.fechaInicio,
      fechaFin: plan.fechaFin,
      hoy: HOY,
    })

    expect(riesgo.nivel).toBe(nivel)
  })
})

describe('claves de idempotencia del demo', () => {
  it('no repite claves de aviso por usuario', () => {
    const trabajador = 'trabajador'
    const encargado = 'encargado'
    const admin = 'admin'

    const recordatorios = Array.from({ length: SEMANAS_DEMO }, (_, desplazamiento) => {
      const semana = semanaIsoDe(sumarDias(SEMANA_ACTUAL.weekStart, -7 * desplazamiento))
      return claveRecordatorio(trabajador, semana, 'manual', HOY)
    })

    const equipo = Array.from({ length: 5 }, (_, desplazamiento) => {
      const semana = semanaIsoDe(sumarDias(SEMANA_ACTUAL.weekStart, -7 * (desplazamiento + 1)))
      return claveEquipoPendiente(encargado, semana, 'manual', HOY)
    })

    const riesgosTrabajador = PROYECTOS.map((proyectoId) =>
      claveRiesgoProyecto(trabajador, proyectoId, 'CRITICO', HOY),
    )
    const riesgosEncargado = PROYECTOS.slice(0, 4).map((proyectoId) =>
      claveRiesgoProyecto(encargado, proyectoId, 'AVISO', HOY),
    )
    const riesgosAdmin = PROYECTOS.slice(2, 5).map((proyectoId) =>
      claveRiesgoProyecto(admin, proyectoId, 'AGOTADO', HOY),
    )

    for (const claves of [
      [...recordatorios, ...riesgosTrabajador],
      [...equipo, ...riesgosEncargado],
      riesgosAdmin,
    ]) {
      expect(new Set(claves).size).toBe(claves.length)
    }
  })

  it('separa los correos por tipo aunque compartan clave de aviso', () => {
    const claveAviso = claveRiesgoProyecto('trabajador', 'proyecto-0', 'CRITICO', HOY)

    expect(claveEmail('RIESGO_PROYECTO', claveAviso)).not.toBe(
      claveEmail('RECORDATORIO_PARTE', claveAviso),
    )
  })
})
