import { ETIQUETAS_CUMPLIMIENTO } from '@/modules/reporting/domain/cumplimiento'
import { ETIQUETAS_RIESGO } from '@/modules/reporting/domain/riesgo'
import {
  INDICADORES,
  ITEMS_ESTADO,
  ITEMS_RIESGO,
  ITEMS_SEMAFORO,
  NOTA_BLOQUEADO,
  NOTA_NEUTRO,
  NOTA_RIESGO_CABECERA,
} from './leyenda'

const ordenado = (valores: readonly string[]) => [...valores].sort()

/** Todos los textos que se pintan en la leyenda, para las comprobaciones comunes. */
const TEXTOS: readonly string[] = [
  ...ITEMS_SEMAFORO.flatMap((item) => [item.etiqueta, item.descripcion]),
  ...ITEMS_RIESGO.flatMap((item) => [item.etiqueta, item.descripcion]),
  ...ITEMS_ESTADO.flatMap((item) => [item.etiqueta, item.descripcion]),
  ...INDICADORES.flatMap((indicador) => [indicador.etiqueta, indicador.descripcion]),
  NOTA_NEUTRO,
  NOTA_RIESGO_CABECERA,
  NOTA_BLOQUEADO,
]

describe('leyenda del dashboard', () => {
  it('documenta todos los niveles de riesgo del dominio', () => {
    expect(ordenado(ITEMS_RIESGO.map((item) => item.etiqueta))).toEqual(
      ordenado(Object.values(ETIQUETAS_RIESGO)),
    )
  })

  it('documenta todos los estados de parte del dominio', () => {
    expect(ordenado(ITEMS_ESTADO.map((item) => item.etiqueta))).toEqual(
      ordenado(Object.values(ETIQUETAS_CUMPLIMIENTO)),
    )
  })

  it('lista solo los tres niveles del semáforo que llevan píldora', () => {
    expect(ITEMS_SEMAFORO.map((item) => item.clave)).toEqual(['ALERTA', 'AVISO', 'OK'])
  })

  it('no repite claves dentro de cada vocabulario', () => {
    for (const claves of [
      ITEMS_SEMAFORO.map((item) => item.clave),
      ITEMS_RIESGO.map((item) => item.clave),
      ITEMS_ESTADO.map((item) => item.clave),
    ]) {
      expect(new Set(claves).size).toBe(claves.length)
    }
  })

  it('no deja etiquetas vacías ni con espacios sobrantes', () => {
    for (const item of [...ITEMS_SEMAFORO, ...ITEMS_RIESGO, ...ITEMS_ESTADO]) {
      expect(item.etiqueta.length).toBeGreaterThan(0)
      expect(item.etiqueta).toBe(item.etiqueta.trim())
    }
  })

  it('no deja descripciones vacías ni iguales a su etiqueta', () => {
    for (const item of [...ITEMS_SEMAFORO, ...ITEMS_RIESGO, ...ITEMS_ESTADO]) {
      expect(item.descripcion.length).toBeGreaterThan(0)
      expect(item.descripcion).not.toBe(item.etiqueta)
    }
  })

  it('no repite la misma descripción entre items', () => {
    const descripciones = [...ITEMS_SEMAFORO, ...ITEMS_RIESGO, ...ITEMS_ESTADO].map(
      (item) => item.descripcion,
    )
    expect(new Set(descripciones).size).toBe(descripciones.length)
  })

  it('explica cada tarjeta del hero y la antigüedad', () => {
    expect(ordenado(INDICADORES.map((indicador) => indicador.etiqueta))).toEqual(
      ordenado(['Cumplimiento', 'Pendientes', 'Sin enviar', 'En riesgo', 'Antigüedad máxima']),
    )
  })

  it('usa guion normal, nunca guion medio ni largo', () => {
    for (const texto of TEXTOS) {
      expect(texto).not.toMatch(/[\u2013\u2014]/)
    }
  })

  it('incluye las notas de contexto sin dejar huecos', () => {
    for (const nota of [NOTA_NEUTRO, NOTA_RIESGO_CABECERA, NOTA_BLOQUEADO]) {
      expect(nota.trim().length).toBeGreaterThan(0)
    }
  })
})
