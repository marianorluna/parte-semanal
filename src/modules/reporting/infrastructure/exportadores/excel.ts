import ExcelJS from 'exceljs'
import { desviacion, horas, nombreSemana } from './comun'
import type { DatosDashboardExport, DatosPartesExport, LineaParte } from './comun'

const COLOR_MARCA = 'FF005453'
const COLOR_ACENTO = 'FF009878'
const COLOR_FONDO = 'FFEEF7F7'

type Columna = {
  cabecera: string
  clave: string
  ancho: number
  formato?: string
  alineacion?: 'left' | 'right' | 'center'
}

function titulo(hoja: ExcelJS.Worksheet, texto: string, subtitulo?: string) {
  hoja.mergeCells('A1', `E1`)
  const celdaTitulo = hoja.getCell('A1')
  celdaTitulo.value = texto
  celdaTitulo.font = { bold: true, size: 16, color: { argb: COLOR_MARCA } }
  celdaTitulo.alignment = { vertical: 'middle' }

  if (subtitulo) {
    hoja.mergeCells('A2', `E2`)
    const celdaSubtitulo = hoja.getCell('A2')
    celdaSubtitulo.value = subtitulo
    celdaSubtitulo.font = { size: 10, color: { argb: 'FF475569' } }
  }

  hoja.getRow(1).height = 24
}

function tabla(hoja: ExcelJS.Worksheet, filaInicial: number, columnas: Columna[], filas: Record<string, string | number | null>[]) {
  for (const [indice, columna] of columnas.entries()) {
    hoja.getColumn(indice + 1).width = columna.ancho
  }

  const filaCabecera = hoja.getRow(filaInicial)
  for (const [indice, columna] of columnas.entries()) {
    const celda = filaCabecera.getCell(indice + 1)
    celda.value = columna.cabecera
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_MARCA } }
    celda.alignment = { vertical: 'middle', horizontal: columna.alineacion ?? 'left' }
    celda.border = { bottom: { style: 'thin', color: { argb: COLOR_ACENTO } } }
  }
  filaCabecera.height = 20

  for (const [indiceFila, datos] of filas.entries()) {
    const fila = hoja.getRow(filaInicial + 1 + indiceFila)
    for (const [indice, columna] of columnas.entries()) {
      const celda = fila.getCell(indice + 1)
      celda.value = datos[columna.clave] ?? null
      celda.alignment = { vertical: 'middle', horizontal: columna.alineacion ?? 'left' }
      if (columna.formato) celda.numFmt = columna.formato
      if (indiceFila % 2 === 1) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_FONDO } }
      }
    }
  }

  const ultimaFila = filaInicial + filas.length
  hoja.autoFilter = {
    from: { row: filaInicial, column: 1 },
    to: { row: Math.max(ultimaFila, filaInicial), column: columnas.length },
  }
  hoja.views = [{ state: 'frozen', ySplit: filaInicial }]
}

function agruparPorEmpleado(lineas: LineaParte[]) {
  const mapa = new Map<
    string,
    { empleado: string; codigo: string; estado: string; minutos: number; dias: Set<string>; proyectos: Set<string> }
  >()

  for (const linea of lineas) {
    const clave = linea.empleadoCodigo
    const actual =
      mapa.get(clave) ??
      {
        empleado: linea.empleadoNombre,
        codigo: linea.empleadoCodigo,
        estado: linea.estado,
        minutos: 0,
        dias: new Set<string>(),
        proyectos: new Set<string>(),
      }

    actual.minutos += linea.minutos
    actual.dias.add(linea.fecha)
    actual.proyectos.add(linea.proyectoCodigo)
    mapa.set(clave, actual)
  }

  return [...mapa.values()].sort((a, b) => a.empleado.localeCompare(b.empleado, 'es'))
}

export async function construirExcelPartes(datos: DatosPartesExport): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Parte semanal · Levitec'
  libro.created = new Date()

  const resumen = libro.addWorksheet('Resumen')
  titulo(resumen, 'Parte semanal · Levitec', `${datos.empresa} · ${datos.semana.isoYear} W${datos.semana.isoWeek}`)
  resumen.addRow([])
  resumen.addRow(['Semana', `W${datos.semana.isoWeek} de ${datos.semana.isoYear}`])
  resumen.addRow(['Desde', datos.semana.weekStart])
  resumen.addRow(['Hasta', datos.semana.weekEnd])
  resumen.addRow(['Partes', datos.resumen.partes])
  resumen.addRow(['Empleados con horas', datos.resumen.empleados])
  resumen.addRow(['Imputaciones', datos.resumen.lineas])
  resumen.addRow(['Horas totales', Number(horas(datos.resumen.totalMinutos).replace(',', '.'))])
  resumen.getColumn(1).width = 24
  resumen.getColumn(2).width = 32
  for (let fila = 3; fila <= resumen.rowCount; fila += 1) {
    resumen.getCell(`A${fila}`).font = { bold: true, color: { argb: COLOR_MARCA } }
  }
  resumen.getCell(`B${resumen.rowCount}`).numFmt = '0.00'

  const partes = libro.addWorksheet('Partes')
  tabla(
    partes,
    1,
    [
      { cabecera: 'Empleado', clave: 'empleado', ancho: 30 },
      { cabecera: 'Código', clave: 'codigo', ancho: 14 },
      { cabecera: 'Estado', clave: 'estado', ancho: 14 },
      { cabecera: 'Días con horas', clave: 'dias', ancho: 16, alineacion: 'right', formato: '0' },
      { cabecera: 'Proyectos', clave: 'proyectos', ancho: 12, alineacion: 'right', formato: '0' },
      { cabecera: 'Horas', clave: 'horas', ancho: 10, alineacion: 'right', formato: '0.00' },
    ],
    agruparPorEmpleado(datos.lineas).map((fila) => ({
      empleado: fila.empleado,
      codigo: fila.codigo,
      estado: fila.estado,
      dias: fila.dias.size,
      proyectos: fila.proyectos.size,
      horas: Number(horas(fila.minutos).replace(',', '.')),
    })),
  )

  const imputaciones = libro.addWorksheet('Imputaciones')
  tabla(
    imputaciones,
    1,
    [
      { cabecera: 'Empleado', clave: 'empleado', ancho: 28 },
      { cabecera: 'Código', clave: 'codigo', ancho: 12 },
      { cabecera: 'Proyecto', clave: 'proyecto', ancho: 32 },
      { cabecera: 'Cód. proyecto', clave: 'proyectoCodigo', ancho: 14 },
      { cabecera: 'Tarea', clave: 'tarea', ancho: 26 },
      { cabecera: 'Fecha', clave: 'fecha', ancho: 12 },
      { cabecera: 'Horas', clave: 'horas', ancho: 10, alineacion: 'right', formato: '0.00' },
      { cabecera: 'Minutos', clave: 'minutos', ancho: 10, alineacion: 'right', formato: '0' },
      { cabecera: 'Estado', clave: 'estado', ancho: 14 },
      { cabecera: 'Semana', clave: 'semana', ancho: 12 },
    ],
    datos.lineas.map((linea) => ({
      empleado: linea.empleadoNombre,
      codigo: linea.empleadoCodigo,
      proyecto: linea.proyectoNombre,
      proyectoCodigo: linea.proyectoCodigo,
      tarea: linea.tareaNombre,
      fecha: linea.fecha,
      horas: Number(horas(linea.minutos).replace(',', '.')),
      minutos: linea.minutos,
      estado: linea.estado,
      semana: nombreSemana(linea.isoYear, linea.isoWeek),
    })),
  )

  return Buffer.from(await libro.xlsx.writeBuffer())
}

export async function construirExcelDashboard(datos: DatosDashboardExport): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Parte semanal · Levitec'
  libro.created = new Date()

  const resumen = libro.addWorksheet('Resumen')
  titulo(resumen, 'Panel de control · Levitec', `${datos.empresa} · ${datos.semanaEtiqueta}`)
  resumen.addRow([])
  const filaCabecera = resumen.addRow(['Indicador', 'Valor', 'Detalle'])
  filaCabecera.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_MARCA } }
  })
  for (const kpi of datos.kpis) {
    resumen.addRow([kpi.etiqueta, kpi.valor, kpi.detalle])
  }

  resumen.addRow([])
  const filaCumplimiento = resumen.addRow(['Cumplimiento del equipo', 'Personas', ''])
  filaCumplimiento.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACENTO } }
  })
  resumen.addRow(['Aprobados', datos.cumplimiento.aprobados])
  resumen.addRow(['Enviados', datos.cumplimiento.enviados])
  resumen.addRow(['Borradores', datos.cumplimiento.borradores])
  resumen.addRow(['Rechazados', datos.cumplimiento.rechazados])
  resumen.addRow(['Sin parte', datos.cumplimiento.sinParte])
  resumen.addRow(['Cumplimiento de envío (%)', datos.cumplimiento.cumplimientoPct])
  resumen.getColumn(1).width = 30
  resumen.getColumn(2).width = 20
  resumen.getColumn(3).width = 60

  const proyectos = libro.addWorksheet('Proyectos')
  tabla(
    proyectos,
    1,
    [
      { cabecera: 'Proyecto', clave: 'proyecto', ancho: 40 },
      { cabecera: 'Código', clave: 'codigo', ancho: 12 },
      { cabecera: 'Presupuesto (h)', clave: 'presupuesto', ancho: 16, alineacion: 'right', formato: '#,##0' },
      { cabecera: 'Consumido (h)', clave: 'consumido', ancho: 14, alineacion: 'right', formato: '0.00' },
      { cabecera: 'Consumo (%)', clave: 'consumo', ancho: 13, alineacion: 'right', formato: '0' },
      { cabecera: 'Plazo (%)', clave: 'plazo', ancho: 11, alineacion: 'right', formato: '0' },
      { cabecera: 'Desviación', clave: 'desviacion', ancho: 13, alineacion: 'right' },
      { cabecera: 'Proyección (%)', clave: 'proyeccion', ancho: 15, alineacion: 'right', formato: '0' },
      { cabecera: 'Estado', clave: 'estado', ancho: 20 },
    ],
    datos.proyectos.map((proyecto) => ({
      proyecto: proyecto.nombre,
      codigo: proyecto.codigo,
      presupuesto: proyecto.horasPresupuesto,
      consumido: Number(horas(proyecto.minutos).replace(',', '.')),
      consumo: proyecto.consumoPct,
      plazo: proyecto.plazoPct,
      desviacion: desviacion(proyecto.desviacionPp),
      proyeccion: proyecto.proyeccionPct,
      estado: `${proyecto.etiqueta} (${proyecto.nivel})`,
    })),
  )

  const tendencia = libro.addWorksheet('Tendencia')
  tabla(
    tendencia,
    1,
    [
      { cabecera: 'Semana', clave: 'semana', ancho: 12 },
      { cabecera: 'Horas', clave: 'horas', ancho: 12, alineacion: 'right', formato: '0.00' },
    ],
    datos.tendencia.map((fila) => ({
      semana: `W${String(fila.isoWeek).padStart(2, '0')}`,
      horas: Number(horas(fila.minutos).replace(',', '.')),
    })),
  )

  const top = libro.addWorksheet('Top empleados')
  tabla(
    top,
    1,
    [
      { cabecera: 'Puesto', clave: 'puesto', ancho: 10, alineacion: 'right', formato: '0' },
      { cabecera: 'Empleado', clave: 'empleado', ancho: 32 },
      { cabecera: 'Horas', clave: 'horas', ancho: 12, alineacion: 'right', formato: '0.00' },
    ],
    datos.top.map((fila, indice) => ({
      puesto: indice + 1,
      empleado: fila.nombre,
      horas: Number(horas(fila.minutos).replace(',', '.')),
    })),
  )

  return Buffer.from(await libro.xlsx.writeBuffer())
}
