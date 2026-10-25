import type { RepositorioAusencias } from './ports'
import { ausenciasDeSemanaDeEmpleados, type DepsAusencias } from './servicio'
import type { AusenciaVigente } from '../domain/ausencia'

const VACACIONES: AusenciaVigente = {
  id: 'a-1',
  empleadoId: 'e-1',
  desde: '2026-08-03',
  hasta: '2026-08-07',
  minutos: null,
  estado: 'APROBADA',
  tipoId: 't-1',
  tipoNombre: 'Vacaciones',
}

const BAJA: AusenciaVigente = {
  id: 'a-2',
  empleadoId: 'e-2',
  desde: '2026-08-05',
  hasta: '2026-08-05',
  minutos: 240,
  estado: 'APROBADA',
  tipoId: 't-2',
  tipoNombre: 'Baja',
}

function repositorioFalso(
  overrides: Partial<RepositorioAusencias> = {},
): RepositorioAusencias {
  const base: RepositorioAusencias = {
    listarTipos: async () => [],
    crearTipo: async () => 'tipo-1',
    actualizarTipo: async () => {},
    alternarTipo: async () => {},
    obtenerTipo: async () => null,
    listar: async () => [],
    obtener: async () => null,
    crear: async () => 'ausencia-1',
    cambiarEstado: async () => {},
    aprobadasEnRango: async () => [],
    aprobadasDeEmpleado: async () => [],
    aprobadasDeEmpleados: async () => [],
    listarSaldos: async () => [],
    perteneceAEmpresa: async () => true,
    guardarSaldo: async () => {},
  }
  return { ...base, ...overrides }
}

function depsFalso(repo: RepositorioAusencias): DepsAusencias {
  return { repo, capacidad: async () => ({}) }
}

describe('ausencias de la semana del equipo', () => {
  it('agrupa las ausencias por empleado', async () => {
    const deps = depsFalso(
      repositorioFalso({ aprobadasDeEmpleados: async () => [VACACIONES, BAJA] }),
    )

    const resultado = await ausenciasDeSemanaDeEmpleados(
      deps,
      ['e-1', 'e-2'],
      '2026-08-03',
      '2026-08-09',
    )

    expect(resultado.get('e-1')).toEqual([VACACIONES])
    expect(resultado.get('e-2')).toEqual([BAJA])
  })

  it('acumula varias ausencias del mismo empleado en el orden recibido', async () => {
    const segunda: AusenciaVigente = { ...BAJA, id: 'a-3', empleadoId: 'e-1', desde: '2026-08-08' }
    const deps = depsFalso(repositorioFalso({ aprobadasDeEmpleados: async () => [VACACIONES, segunda] }))

    const resultado = await ausenciasDeSemanaDeEmpleados(deps, ['e-1'], '2026-08-03', '2026-08-09')

    expect(resultado.get('e-1')?.map((ausencia) => ausencia.id)).toEqual(['a-1', 'a-3'])
  })

  it('devuelve un mapa vacío sin consultar al repositorio si no hay empleados', async () => {
    let consultado = false
    const deps = depsFalso(
      repositorioFalso({
        aprobadasDeEmpleados: async () => {
          consultado = true
          return []
        },
      }),
    )

    const resultado = await ausenciasDeSemanaDeEmpleados(deps, [], '2026-08-03', '2026-08-09')

    expect(resultado.size).toBe(0)
    expect(consultado).toBe(false)
  })

  it('deja fuera a los empleados sin ausencia', async () => {
    const deps = depsFalso(repositorioFalso({ aprobadasDeEmpleados: async () => [VACACIONES] }))

    const resultado = await ausenciasDeSemanaDeEmpleados(
      deps,
      ['e-1', 'e-2'],
      '2026-08-03',
      '2026-08-09',
    )

    expect(resultado.has('e-2')).toBe(false)
  })
})
