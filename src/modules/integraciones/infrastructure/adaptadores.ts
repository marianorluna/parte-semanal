/**
 * Adaptadores CSV para nómina y fichaje. El dominio no conoce A3, Sage ni
 * Factorial: cada integración concreta se implementa sobre estas interfaces.
 */

import { minutosAHorasDecimal } from '@/modules/partes/domain/horas'

export type LineaNomina = {
  empleadoCodigo: string
  empleadoNombre: string
  fecha: string
  proyectoCodigo: string
  tareaCodigo: string
  tipoHora: string
  minutos: number
}

export type NominaExporter = {
  nombre: string
  exportar(lineas: readonly LineaNomina[]): string
}

export type LineaFichaje = {
  empleadoCodigo: string
  fecha: string
  minutos: number
}

export type ResultadoImportacion = {
  lineas: LineaFichaje[]
  errores: { linea: number; mensaje: string }[]
}

export type FichajeImporter = {
  nombre: string
  importar(contenido: string): ResultadoImportacion
}

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/

function escaparCsv(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor
}

/**
 * Exportación de nómina genérica con separador `;` (Excel en español) y BOM,
 * para que los acentos se abran correctamente sin asistentes de importación.
 */
export const exportadorNominaCsv: NominaExporter = {
  nombre: 'csv-generico',
  exportar(lineas) {
    const cabecera = [
      'empleado_codigo',
      'empleado_nombre',
      'fecha',
      'proyecto_codigo',
      'tarea_codigo',
      'tipo_hora',
      'minutos',
      'horas',
    ]
    const filas = lineas.map((linea) =>
      [
        linea.empleadoCodigo,
        linea.empleadoNombre,
        linea.fecha,
        linea.proyectoCodigo,
        linea.tareaCodigo,
        linea.tipoHora,
        String(linea.minutos),
        minutosAHorasDecimal(linea.minutos),
      ]
        .map((valor) => escaparCsv(valor))
        .join(';'),
    )

    return `\uFEFF${[cabecera.join(';'), ...filas].join('\r\n')}\r\n`
  },
}

function separadorDe(cabecera: string): ';' | ',' {
  return cabecera.includes(';') ? ';' : ','
}

/**
 * Importación de fichajes. Acepta `;` o `,` y cabeceras en cualquier orden.
 * Devuelve los errores por fila en lugar de abortar el lote completo.
 */
export const importadorFichajeCsv: FichajeImporter = {
  nombre: 'csv-generico',
  importar(contenido) {
    const limpio = contenido.replace(/^\uFEFF/, '').trim()
    if (!limpio) return { lineas: [], errores: [] }

    const filas = limpio.split(/\r?\n/).filter((fila) => fila.trim() !== '')
    const cabecera = filas[0]
    if (!cabecera) return { lineas: [], errores: [] }

    const separador = separadorDe(cabecera)
    const columnas = cabecera.split(separador).map((columna) => columna.trim().toLowerCase())
    const indiceEmpleado = columnas.indexOf('empleado_codigo')
    const indiceFecha = columnas.indexOf('fecha')
    const indiceMinutos = columnas.indexOf('minutos')

    if (indiceEmpleado < 0 || indiceFecha < 0 || indiceMinutos < 0) {
      return {
        lineas: [],
        errores: [
          {
            linea: 1,
            mensaje: 'La cabecera debe incluir empleado_codigo, fecha y minutos',
          },
        ],
      }
    }

    const lineas: LineaFichaje[] = []
    const errores: { linea: number; mensaje: string }[] = []

    for (let indice = 1; indice < filas.length; indice += 1) {
      const fila = filas[indice]
      if (!fila) continue
      const celdas = fila.split(separador).map((celda) => celda.trim())
      const numeroLinea = indice + 1
      const codigo = celdas[indiceEmpleado] ?? ''
      const fecha = celdas[indiceFecha] ?? ''
      const minutos = Number(celdas[indiceMinutos] ?? '')

      if (!codigo) {
        errores.push({ linea: numeroLinea, mensaje: 'Falta el código de empleado' })
        continue
      }
      if (!PATRON_FECHA.test(fecha)) {
        errores.push({ linea: numeroLinea, mensaje: `Fecha inválida: ${fecha || '(vacía)'}` })
        continue
      }
      if (!Number.isInteger(minutos) || minutos < 1 || minutos > 1440) {
        errores.push({
          linea: numeroLinea,
          mensaje: `Minutos inválidos: ${celdas[indiceMinutos] ?? '(vacíos)'}`,
        })
        continue
      }

      lineas.push({ empleadoCodigo: codigo, fecha, minutos })
    }

    return { lineas, errores }
  },
}
