import ExcelJS from 'exceljs'
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import type { ColumnaInforme, FormatoInforme, TablaInforme } from '../domain/informe'
import { MARCA } from '@/config/marca'

const COLOR_MARCA = 'FF005453'
const COLOR_ACENTO = 'FF009878'
const COLOR_FONDO = 'FFEEF7F7'
const SEPARADOR = ';'

function valorCelda(columna: ColumnaInforme, valor: string | number | null): string {
  if (valor === null || valor === '') return ''
  if (columna.tipo === 'numero') return String(valor).replace('.', ',')
  return String(valor)
}

function escapar(texto: string): string {
  if (texto.includes(SEPARADOR) || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

export function generarCsv(tabla: TablaInforme): Buffer {
  const lineas: string[] = [escapar(tabla.titulo), escapar(tabla.subtitulo), '']

  for (const fila of tabla.resumen) {
    lineas.push([escapar(fila.etiqueta), escapar(fila.valor)].join(SEPARADOR))
  }
  if (tabla.resumen.length > 0) lineas.push('')

  lineas.push(tabla.columnas.map((columna) => escapar(columna.etiqueta)).join(SEPARADOR))
  for (const fila of tabla.filas) {
    lineas.push(
      tabla.columnas
        .map((columna) => escapar(valorCelda(columna, fila[columna.clave] ?? null)))
        .join(SEPARADOR),
    )
  }

  return Buffer.from(`\uFEFF${lineas.join('\r\n')}\r\n`, 'utf8')
}

export async function generarXlsx(tabla: TablaInforme): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  libro.creator = `${MARCA.nombre} - Parte semanal`
  libro.created = new Date()

  const hoja = libro.addWorksheet('Informe')
  const ultimaColumna = Math.max(tabla.columnas.length, 2)

  hoja.mergeCells(1, 1, 1, ultimaColumna)
  const celdaTitulo = hoja.getCell(1, 1)
  celdaTitulo.value = tabla.titulo
  celdaTitulo.font = { bold: true, size: 16, color: { argb: COLOR_MARCA } }

  hoja.mergeCells(2, 1, 2, ultimaColumna)
  const celdaSubtitulo = hoja.getCell(2, 1)
  celdaSubtitulo.value = tabla.subtitulo
  celdaSubtitulo.font = { size: 10, color: { argb: 'FF475569' } }

  let fila = 4
  for (const resumen of tabla.resumen) {
    hoja.getCell(fila, 1).value = resumen.etiqueta
    hoja.getCell(fila, 1).font = { bold: true, color: { argb: COLOR_MARCA } }
    hoja.getCell(fila, 2).value = resumen.valor
    fila += 1
  }

  fila += 1
  const filaCabecera = hoja.getRow(fila)
  for (const [indice, columna] of tabla.columnas.entries()) {
    const celda = filaCabecera.getCell(indice + 1)
    celda.value = columna.etiqueta
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_MARCA } }
    celda.alignment = { vertical: 'middle', horizontal: 'left' }
    celda.border = { bottom: { style: 'thin', color: { argb: COLOR_ACENTO } } }
    hoja.getColumn(indice + 1).width = Math.max(10, Math.min(48, (columna.ancho ?? 18) * 1.1))
  }

  for (const [indiceFila, datos] of tabla.filas.entries()) {
    const row = hoja.getRow(fila + 1 + indiceFila)
    for (const [indice, columna] of tabla.columnas.entries()) {
      const celda = row.getCell(indice + 1)
      celda.value = datos[columna.clave] ?? null
      celda.alignment = {
        vertical: 'middle',
        horizontal: columna.tipo === 'numero' || columna.tipo === 'importe' ? 'right' : 'left',
      }
      if (indiceFila % 2 === 1) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_FONDO } }
      }
    }
  }

  hoja.autoFilter = {
    from: { row: fila, column: 1 },
    to: { row: Math.max(fila + tabla.filas.length, fila), column: tabla.columnas.length },
  }
  hoja.views = [{ state: 'frozen', ySplit: fila }]

  return Buffer.from(await libro.xlsx.writeBuffer())
}

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 22,
    paddingBottom: 30,
    paddingHorizontal: 20,
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 6,
    marginBottom: 10,
  },
  marca: { fontSize: 6.5, letterSpacing: 2, color: '#005453', fontFamily: 'Helvetica-Bold' },
  marcaSufijo: { color: '#009878' },
  titulo: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  subtitulo: { fontSize: 7.5, color: '#475569', marginTop: 2 },
  meta: { fontSize: 7, color: '#475569', textAlign: 'right' },
  resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontSize: 7,
  },
  tabla: { borderTopWidth: 1, borderTopColor: '#005453' },
  filaCabecera: {
    flexDirection: 'row',
    backgroundColor: '#005453',
    color: '#ffffff',
    paddingVertical: 3,
    paddingHorizontal: 2,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
  },
  fila: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  filaAlterna: { backgroundColor: '#f8fafc' },
  celda: { fontSize: 6.5, paddingRight: 2 },
  derecha: { textAlign: 'right' },
  pie: { position: 'absolute', bottom: 14, left: 20, right: 20, fontSize: 6.5, color: '#64748b' },
})

const FILAS_POR_PAGINA = 34

export async function generarPdf(tabla: TablaInforme): Promise<Buffer> {
  const totalAncho = tabla.columnas.reduce((total, columna) => total + (columna.ancho ?? 18), 0)
  const paginas: (typeof tabla.filas)[] = []
  for (let indice = 0; indice < tabla.filas.length; indice += FILAS_POR_PAGINA) {
    paginas.push(tabla.filas.slice(indice, indice + FILAS_POR_PAGINA))
  }
  if (paginas.length === 0) paginas.push([])

  const documento = (
    <Document title={tabla.titulo} author={`${MARCA.nombre} - Parte semanal`}>
      {paginas.map((filas, indicePagina) => (
        <Page key={indicePagina} size="A4" orientation="landscape" style={estilos.pagina}>
          <View style={estilos.cabecera}>
            <View>
              <Text style={estilos.marca}>
                {MARCA.prefijo}
                <Text style={estilos.marcaSufijo}>{MARCA.sufijo}</Text>
              </Text>
              <Text style={estilos.titulo}>{tabla.titulo}</Text>
              <Text style={estilos.subtitulo}>{tabla.subtitulo}</Text>
            </View>
            <Text style={estilos.meta}>
              Página {indicePagina + 1} de {paginas.length}
            </Text>
          </View>

          {indicePagina === 0 && tabla.resumen.length > 0 ? (
            <View style={estilos.resumen}>
              {tabla.resumen.map((fila) => (
                <Text key={fila.etiqueta} style={estilos.chip}>
                  {fila.etiqueta}: {fila.valor}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={estilos.tabla}>
            <View style={estilos.filaCabecera} fixed>
              {tabla.columnas.map((columna) => (
                <Text
                  key={columna.clave}
                  style={[
                    estilos.celda,
                    { flexGrow: (columna.ancho ?? 18) / totalAncho, flexBasis: 0 },
                    columna.tipo === 'numero' || columna.tipo === 'importe' ? estilos.derecha : {},
                  ]}
                >
                  {columna.etiqueta}
                </Text>
              ))}
            </View>

            {filas.map((fila, indiceFila) => (
              <View
                key={indiceFila}
                style={[estilos.fila, indiceFila % 2 === 1 ? estilos.filaAlterna : {}]}
              >
                {tabla.columnas.map((columna) => (
                  <Text
                    key={columna.clave}
                    style={[
                      estilos.celda,
                      { flexGrow: (columna.ancho ?? 18) / totalAncho, flexBasis: 0 },
                      columna.tipo === 'numero' || columna.tipo === 'importe' ? estilos.derecha : {},
                    ]}
                  >
                    {valorCelda(columna, fila[columna.clave] ?? null)}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          <Text style={estilos.pie} fixed>
            {tabla.filas.length} filas · generado por {MARCA.nombre} - Parte semanal
          </Text>
        </Page>
      ))}
    </Document>
  )

  return Buffer.from(await renderToBuffer(documento))
}

export async function generarArchivo(
  tabla: TablaInforme,
  formato: FormatoInforme,
): Promise<Buffer> {
  if (formato === 'CSV') return generarCsv(tabla)
  if (formato === 'XLSX') return generarXlsx(tabla)
  return generarPdf(tabla)
}
