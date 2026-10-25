import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { formatearFecha, formatearRango, type FechaIso } from '@/modules/partes/domain/fechas'
import { MARCA as MARCA_APP } from '@/config/marca'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { ETIQUETAS_SEVERIDAD, severidadCumplimiento } from '@/modules/reporting/domain/severidad'
import type { EstadoCumplimiento } from '@/modules/reporting/domain/cumplimiento'
import {
  PALETA_CUMPLIMIENTO,
  PALETA_RIESGO,
  PALETA_SEVERIDAD,
} from './paleta'
import {
  desviacion,
  etiquetaSemana,
  horas,
  type DatosDashboardExport,
  type DatosParteExport,
  type DatosPartesExport,
  type LineaParte,
} from './comun'

const MARCA = '#005453'
const ACENTO = '#009878'
const TEXTO = '#0f172a'
const SUAVE = '#475569'
const BORDE = '#e2e8f0'
const FONDO = '#f1f5f9'

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 26,
    paddingBottom: 34,
    paddingHorizontal: 26,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: TEXTO,
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 8,
    marginBottom: 12,
  },
  marca: { fontSize: 7, letterSpacing: 2, color: MARCA, fontFamily: 'Helvetica-Bold' },
  marcaSufijo: { color: ACENTO },
  titulo: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  subtitulo: { fontSize: 8.5, color: SUAVE, marginTop: 2 },
  meta: { fontSize: 7.5, color: SUAVE, textAlign: 'right' },
  metaFuerte: { fontFamily: 'Helvetica-Bold', color: TEXTO },
  tabla: { borderTopWidth: 1, borderTopColor: MARCA },
  filaCabecera: {
    flexDirection: 'row',
    backgroundColor: MARCA,
    color: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
  },
  fila: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDE,
  },
  filaAlterna: { backgroundColor: '#f8fafc' },
  celda: { fontSize: 7.5 },
  celdaNumero: { textAlign: 'right' },
  grupo: { marginTop: 10 },
  grupoTitulo: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: MARCA,
    backgroundColor: FONDO,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  total: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  pie: {
    position: 'absolute',
    bottom: 14,
    left: 26,
    right: 26,
    fontSize: 6.5,
    color: '#94a3b8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  marcaAgua: {
    position: 'absolute',
    top: 300,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 64,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    opacity: 0.07,
    transform: 'rotate(-28deg)',
  },
  kpiRejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  kpi: {
    width: '23.5%',
    borderWidth: 0.5,
    borderColor: BORDE,
    borderRadius: 3,
    padding: 6,
  },
  kpiFilaValor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 2 },
  kpiTitulo: { fontSize: 6.5, color: SUAVE, letterSpacing: 0.5 },
  kpiSeveridad: { fontSize: 6, fontFamily: 'Helvetica-Bold', borderRadius: 6, paddingVertical: 1, paddingHorizontal: 3 },
  kpiValor: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  kpiDetalle: { fontSize: 6.5, color: SUAVE, marginTop: 1 },
  avisos: {
    borderWidth: 0.5,
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 10,
  },
  avisosTitulo: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  avisosLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  avisosTexto: { fontSize: 7 },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  leyendaPunto: { width: 5, height: 5, borderRadius: 2.5 },
  leyendaTexto: { fontSize: 6.5, color: SUAVE },
  chipRiesgo: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    borderRadius: 6,
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  celdaEstado: { flex: 1.4, flexDirection: 'row', alignItems: 'center' },
  seccionTitulo: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginBottom: 5, marginTop: 8 },
  dosColumnas: { flexDirection: 'row', gap: 12 },
  columna: { flex: 1 },
  chip: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  chipTexto: { fontSize: 7.5, color: SUAVE },
  chipValor: { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  barraFondo: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginLeft: 6 },
  barraRelleno: { height: 6, backgroundColor: ACENTO, borderRadius: 3 },
  cumplimientoFila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  cumplimientoBarra: { flex: 1, height: 7, backgroundColor: '#e2e8f0', borderRadius: 3.5 },
  cumplimientoRelleno: { height: 7, borderRadius: 3.5 },
  cumplimientoPct: { fontSize: 12, fontFamily: 'Helvetica-Bold', width: 34, textAlign: 'right' },
  chipsFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 },
  chipEstado: { fontSize: 6.5, borderRadius: 6, paddingVertical: 1.5, paddingHorizontal: 4 },
  firma: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40, gap: 30 },
  lineaFirma: { flex: 1, borderTopWidth: 0.5, borderTopColor: '#94a3b8', paddingTop: 3, fontSize: 7, color: SUAVE },
})

function Pie({ titulo }: { titulo: string }) {
  return (
    <View style={estilos.pie} fixed>
      <Text>{titulo}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  )
}

function Cabecera({ titulo, subtitulo, derecha }: { titulo: string; subtitulo: string; derecha?: string[] }) {
  return (
    <View style={estilos.cabecera}>
      <View>
        <Text style={estilos.marca}>
          {MARCA_APP.prefijo}
          <Text style={estilos.marcaSufijo}>{MARCA_APP.sufijo}</Text>
        </Text>
        <Text style={estilos.titulo}>{titulo}</Text>
        <Text style={estilos.subtitulo}>{subtitulo}</Text>
      </View>
      {derecha?.length ? (
        <View>
          {derecha.map((linea) => (
            <Text key={linea} style={estilos.meta}>
              {linea}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function agruparPorEmpleado(lineas: LineaParte[]): { codigo: string; nombre: string; estado: string; lineas: LineaParte[] }[] {
  const mapa = new Map<string, { codigo: string; nombre: string; estado: string; lineas: LineaParte[] }>()

  for (const linea of lineas) {
    const grupo = mapa.get(linea.empleadoCodigo) ?? {
      codigo: linea.empleadoCodigo,
      nombre: linea.empleadoNombre,
      estado: linea.estado,
      lineas: [],
    }
    grupo.lineas.push(linea)
    mapa.set(linea.empleadoCodigo, grupo)
  }

  return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export async function construirPdfPartes(datos: DatosPartesExport): Promise<Buffer> {
  const cabeceras: { texto: string; flex: number; alineacion?: 'right' }[] = [
    { texto: 'Fecha', flex: 0.8 },
    { texto: 'Proyecto', flex: 2.4 },
    { texto: 'Tarea', flex: 1.6 },
    { texto: 'Horas', flex: 0.6, alineacion: 'right' },
  ]

  return renderToBuffer(
    <Document title={`Partes ${datos.semana.isoYear} W${datos.semana.isoWeek}`} author={MARCA_APP.nombre}>
      <Page size="A4" orientation="landscape" style={estilos.pagina} wrap>
        <Cabecera
          titulo="Partes de la semana"
          subtitulo={etiquetaSemana(datos.semana)}
          derecha={[
            datos.empresa,
            `${datos.resumen.empleados} empleados · ${datos.resumen.lineas} imputaciones`,
            `Total: ${horas(datos.resumen.totalMinutos)} h`,
          ]}
        />

        {agruparPorEmpleado(datos.lineas).map((grupo) => {
          const total = grupo.lineas.reduce((suma, linea) => suma + linea.minutos, 0)
          return (
            <View key={grupo.codigo} style={estilos.grupo} wrap={false}>
              <Text style={estilos.grupoTitulo}>
                {grupo.nombre} · {grupo.codigo} · {grupo.estado}
              </Text>
              <View style={estilos.tabla}>
                <View style={estilos.filaCabecera}>
                  {cabeceras.map((columna) => (
                    <Text
                      key={columna.texto}
                      style={[estilos.celda, { flex: columna.flex }, columna.alineacion === 'right' ? estilos.celdaNumero : {}]}
                    >
                      {columna.texto}
                    </Text>
                  ))}
                </View>
                {grupo.lineas.map((linea, indice) => (
                  <View
                    key={`${linea.fecha}-${linea.proyectoCodigo}-${linea.tareaCodigo}-${indice}`}
                    style={indice % 2 === 1 ? [estilos.fila, estilos.filaAlterna] : estilos.fila}
                  >
                    <Text style={[estilos.celda, { flex: 0.8 }]}>{formatearFecha(linea.fecha as FechaIso)}</Text>
                    <Text style={[estilos.celda, { flex: 2.4 }]}>
                      {linea.proyectoCodigo} · {linea.proyectoNombre}
                    </Text>
                    <Text style={[estilos.celda, { flex: 1.6 }]}>{linea.tareaNombre}</Text>
                    <Text style={[estilos.celda, estilos.celdaNumero, { flex: 0.6 }]}>{horas(linea.minutos)}</Text>
                  </View>
                ))}
                <View style={estilos.total}>
                  <Text style={{ flex: 3.8 }}>Total {grupo.nombre}</Text>
                  <Text style={{ flex: 0.6, textAlign: 'right' }}>{formatearHorasReloj(total)}</Text>
                </View>
              </View>
            </View>
          )
        })}

        {datos.lineas.length === 0 ? <Text style={estilos.subtitulo}>Sin imputaciones en la semana.</Text> : null}

        <Pie titulo={`${datos.empresa} · Partes ${datos.semana.isoYear} W${datos.semana.isoWeek}`} />
      </Page>
    </Document>,
  )
}

export async function construirPdfDashboard(datos: DatosDashboardExport): Promise<Buffer> {
  const columnas: { texto: string; flex: number; alineacion?: 'right' }[] = [
    { texto: 'Proyecto', flex: 3 },
    { texto: 'Presup.', flex: 0.9, alineacion: 'right' },
    { texto: 'Consumido', flex: 1, alineacion: 'right' },
    { texto: 'Consumo', flex: 0.9, alineacion: 'right' },
    { texto: 'Plazo', flex: 0.8, alineacion: 'right' },
    { texto: 'Desviación', flex: 1, alineacion: 'right' },
    { texto: 'Proyección', flex: 1, alineacion: 'right' },
    { texto: 'Estado', flex: 1.4 },
  ]

  const maximoTendencia = Math.max(...datos.tendencia.map((fila) => fila.minutos), 1)
  const maximoTop = Math.max(...datos.top.map((fila) => fila.minutos), 1)

  const coloresAvisos = PALETA_SEVERIDAD[datos.severidadAvisos]
  const severidadCumplimientoValor = severidadCumplimiento(datos.cumplimiento.cumplimientoPct)
  const coloresCumplimiento = PALETA_SEVERIDAD[severidadCumplimientoValor]

  const leyenda: { nivel: keyof typeof PALETA_RIESGO; texto: string }[] = [
    { nivel: 'OK', texto: 'En ritmo' },
    { nivel: 'AVISO', texto: 'Vigilar' },
    { nivel: 'CRITICO', texto: 'Riesgo alto' },
    { nivel: 'AGOTADO', texto: 'Presupuesto agotado' },
  ]

  const estadosCumplimiento: { estado: EstadoCumplimiento; etiqueta: string; valor: number }[] = [
    { estado: 'APROBADO', etiqueta: 'Aprobados', valor: datos.cumplimiento.aprobados },
    { estado: 'ENVIADO', etiqueta: 'Enviados', valor: datos.cumplimiento.enviados },
    { estado: 'BORRADOR', etiqueta: 'Borradores', valor: datos.cumplimiento.borradores },
    { estado: 'RECHAZADO', etiqueta: 'Rechazados', valor: datos.cumplimiento.rechazados },
    { estado: 'SIN_PARTE', etiqueta: 'Sin parte', valor: datos.cumplimiento.sinParte },
  ]

  return renderToBuffer(
    <Document title={`Dashboard ${datos.semanaEtiqueta}`} author={MARCA_APP.nombre}>
      <Page size="A4" orientation="landscape" style={estilos.pagina}>
        <Cabecera
          titulo="Panel de control"
          subtitulo={datos.semanaEtiqueta}
          derecha={[datos.empresa, `Generado el ${formatearFecha(datos.hoy)}`]}
        />

        <View
          style={[
            estilos.avisos,
            { backgroundColor: coloresAvisos.fondo, borderColor: coloresAvisos.borde },
          ]}
        >
          <Text style={[estilos.avisosTitulo, { color: coloresAvisos.texto }]}>
            {datos.avisos.length > 0 ? 'Necesita tu atención' : 'Sin incidencias en la semana'}
          </Text>
          {datos.avisos.length > 0 ? (
            <View style={estilos.avisosLista}>
              {datos.avisos.map((aviso) => (
                <Text key={aviso.texto} style={[estilos.avisosTexto, { color: coloresAvisos.texto }]}>
                  · {aviso.texto}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={[estilos.avisosTexto, { color: coloresAvisos.texto }]}>
              Sin partes pendientes de revisión ni proyectos en riesgo.
            </Text>
          )}
        </View>

        <View style={estilos.kpiRejilla}>
          {datos.kpis.map((kpi) => {
            const colores = PALETA_SEVERIDAD[kpi.severidad]
            const conSemaforo = kpi.severidad !== 'NEUTRO'
            return (
              <View
                key={kpi.etiqueta}
                style={[estilos.kpi, conSemaforo ? { borderColor: colores.borde } : {}]}
              >
                <Text style={estilos.kpiTitulo}>{kpi.etiqueta.toUpperCase()}</Text>
                <View style={estilos.kpiFilaValor}>
                  <Text style={[estilos.kpiValor, conSemaforo ? { color: colores.texto } : {}]}>
                    {kpi.valor}
                  </Text>
                  {conSemaforo ? (
                    <Text style={[estilos.kpiSeveridad, { backgroundColor: colores.fondo, color: colores.texto }]}>
                      {ETIQUETAS_SEVERIDAD[kpi.severidad]}
                    </Text>
                  ) : null}
                </View>
                <Text style={estilos.kpiDetalle}>{kpi.detalle}</Text>
              </View>
            )
          })}
        </View>

        <Text style={estilos.seccionTitulo}>Presupuesto y plazo por proyecto</Text>
        <View style={estilos.tabla}>
          <View style={estilos.filaCabecera}>
            {columnas.map((columna) => (
              <Text
                key={columna.texto}
                style={[estilos.celda, { flex: columna.flex }, columna.alineacion === 'right' ? estilos.celdaNumero : {}]}
              >
                {columna.texto}
              </Text>
            ))}
          </View>
          {datos.proyectos.map((proyecto, indice) => (
            <View
              key={proyecto.codigo}
              style={indice % 2 === 1 ? [estilos.fila, estilos.filaAlterna] : estilos.fila}
            >
              <Text style={[estilos.celda, { flex: 3 }]}>
                {proyecto.codigo} · {proyecto.nombre}
              </Text>
              <Text style={[estilos.celda, estilos.celdaNumero, { flex: 0.9 }]}>
                {proyecto.horasPresupuesto ?? '—'}
              </Text>
              <Text style={[estilos.celda, estilos.celdaNumero, { flex: 1 }]}>{horas(proyecto.minutos)}</Text>
              <Text
                style={[
                  estilos.celda,
                  estilos.celdaNumero,
                  { flex: 0.9 },
                  proyecto.consumoPct !== null && proyecto.consumoPct >= 90
                    ? { color: PALETA_SEVERIDAD.ALERTA.texto, fontFamily: 'Helvetica-Bold' }
                    : {},
                ]}
              >
                {proyecto.consumoPct === null ? '—' : `${proyecto.consumoPct}%`}
              </Text>
              <Text style={[estilos.celda, estilos.celdaNumero, { flex: 0.8 }]}>
                {proyecto.plazoPct === null ? '—' : `${proyecto.plazoPct}%`}
              </Text>
              <Text
                style={[
                  estilos.celda,
                  estilos.celdaNumero,
                  { flex: 1 },
                  (proyecto.desviacionPp ?? 0) >= 10
                    ? { color: PALETA_RIESGO.CRITICO.texto, fontFamily: 'Helvetica-Bold' }
                    : {},
                ]}
              >
                {desviacion(proyecto.desviacionPp)}
              </Text>
              <Text style={[estilos.celda, estilos.celdaNumero, { flex: 1 }]}>
                {proyecto.proyeccionPct === null ? '—' : `${proyecto.proyeccionPct}%`}
              </Text>
              <View style={estilos.celdaEstado}>
                <Text
                  style={[
                    estilos.chipRiesgo,
                    {
                      backgroundColor: PALETA_RIESGO[proyecto.nivel].fondo,
                      color: PALETA_RIESGO[proyecto.nivel].texto,
                    },
                  ]}
                >
                  {proyecto.etiqueta}
                </Text>
              </View>
            </View>
          ))}
        </View>
        {datos.proyectos.length === 0 ? <Text style={estilos.subtitulo}>Sin proyectos en tu ámbito.</Text> : null}

        <View style={estilos.leyenda}>
          {leyenda.map((item) => (
            <View key={item.nivel} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={[estilos.leyendaPunto, { backgroundColor: PALETA_RIESGO[item.nivel].texto }]} />
              <Text style={estilos.leyendaTexto}>{item.texto}</Text>
            </View>
          ))}
          <Text style={estilos.leyendaTexto}>
            · Verde: consumo en línea con el plazo. Ámbar y naranja: conviene revisarlo. Rojo: sin horas disponibles o
            desviación severa.
          </Text>
        </View>

        <View style={estilos.dosColumnas}>
          <View style={estilos.columna}>
            <Text style={estilos.seccionTitulo}>Cumplimiento del equipo</Text>
            <View style={estilos.cumplimientoFila}>
              <View style={estilos.cumplimientoBarra}>
                <View
                  style={[
                    estilos.cumplimientoRelleno,
                    {
                      width: `${Math.min(Math.max(datos.cumplimiento.cumplimientoPct, 0), 100)}%`,
                      backgroundColor: coloresCumplimiento.texto,
                    },
                  ]}
                />
              </View>
              <Text style={[estilos.cumplimientoPct, { color: coloresCumplimiento.texto }]}>
                {datos.cumplimiento.cumplimientoPct}%
              </Text>
            </View>
            <Text style={[estilos.chipTexto, { color: coloresCumplimiento.texto, fontFamily: 'Helvetica-Bold' }]}>
              {ETIQUETAS_SEVERIDAD[severidadCumplimientoValor]} · partes enviados o aprobados sobre{' '}
              {datos.cumplimiento.total} personas
            </Text>
            <View style={estilos.chipsFila}>
              {estadosCumplimiento.map(({ estado, etiqueta, valor }) => (
                <Text
                  key={estado}
                  style={[
                    estilos.chipEstado,
                    {
                      backgroundColor: PALETA_CUMPLIMIENTO[estado].fondo,
                      color: PALETA_CUMPLIMIENTO[estado].texto,
                    },
                  ]}
                >
                  {etiqueta}: {valor}
                </Text>
              ))}
            </View>
          </View>

          <View style={estilos.columna}>
            <Text style={estilos.seccionTitulo}>Tendencia de las últimas 8 semanas</Text>
            {datos.tendencia.map((fila) => (
              <View key={fila.isoWeek} style={estilos.chip}>
                <Text style={estilos.chipTexto}>W{fila.isoWeek}</Text>
                <View style={estilos.barraFondo}>
                  <View style={[estilos.barraRelleno, { width: `${Math.round((fila.minutos / maximoTendencia) * 100)}%` }]} />
                </View>
                <Text style={estilos.chipValor}> {horas(fila.minutos)}</Text>
              </View>
            ))}
            {datos.tendencia.length === 0 ? <Text style={estilos.subtitulo}>Sin datos.</Text> : null}
          </View>

          <View style={estilos.columna}>
            <Text style={estilos.seccionTitulo}>Top 5 empleados</Text>
            {datos.top.map((fila, indice) => (
              <View key={fila.nombre} style={estilos.chip}>
                <Text style={estilos.chipTexto}>
                  {indice + 1}. {fila.nombre}
                </Text>
                <View style={estilos.barraFondo}>
                  <View style={[estilos.barraRelleno, { width: `${Math.round((fila.minutos / maximoTop) * 100)}%` }]} />
                </View>
                <Text style={estilos.chipValor}> {horas(fila.minutos)}</Text>
              </View>
            ))}
            {datos.top.length === 0 ? <Text style={estilos.subtitulo}>Sin datos.</Text> : null}
          </View>
        </View>

        <Pie titulo={`${datos.empresa} · Panel de control · ${datos.semanaEtiqueta}`} />
      </Page>
    </Document>,
  )
}

export async function construirPdfParte(datos: DatosParteExport): Promise<Buffer> {
  const { parte } = datos
  const dias = new Map<string, number>()
  for (const linea of parte.imputaciones) {
    dias.set(linea.fecha, (dias.get(linea.fecha) ?? 0) + linea.minutos)
  }

  return renderToBuffer(
    <Document title={`Parte ${parte.empleadoCodigo} ${parte.isoYear} W${parte.isoWeek}`} author={MARCA_APP.nombre}>
      <Page size="A4" style={estilos.pagina}>
        <Text style={estilos.marcaAgua}>{parte.estado.toUpperCase()}</Text>

        <Cabecera
          titulo="Parte semanal de horas"
          subtitulo={`Semana ${parte.isoWeek} de ${parte.isoYear} · ${formatearRango(parte.weekStart as FechaIso, parte.weekEnd as FechaIso)}`}
          derecha={[
            parte.empleadoNombre,
            `Código ${parte.empleadoCodigo}`,
            `Estado: ${parte.estado}`,
            `Documento ${parte.id.slice(0, 8)}`,
          ]}
        />

        <View style={estilos.tabla}>
          <View style={estilos.filaCabecera}>
            <Text style={[estilos.celda, { flex: 0.9 }]}>Fecha</Text>
            <Text style={[estilos.celda, { flex: 2.2 }]}>Proyecto</Text>
            <Text style={[estilos.celda, { flex: 1.6 }]}>Tarea</Text>
            <Text style={[estilos.celda, estilos.celdaNumero, { flex: 0.6 }]}>Horas</Text>
          </View>
          {parte.imputaciones.map((linea, indice) => (
            <View key={linea.id} style={indice % 2 === 1 ? [estilos.fila, estilos.filaAlterna] : estilos.fila}>
              <Text style={[estilos.celda, { flex: 0.9 }]}>{formatearFecha(linea.fecha as FechaIso)}</Text>
              <Text style={[estilos.celda, { flex: 2.2 }]}>
                {linea.proyectoCodigo} · {linea.proyectoNombre}
              </Text>
              <Text style={[estilos.celda, { flex: 1.6 }]}>{linea.tareaNombre}</Text>
              <Text style={[estilos.celda, estilos.celdaNumero, { flex: 0.6 }]}>{horas(linea.minutos)}</Text>
            </View>
          ))}
          <View style={estilos.total}>
            <Text style={{ flex: 3.1 }}>Total de la semana</Text>
            <Text style={{ flex: 0.6, textAlign: 'right' }}>{formatearHorasReloj(parte.totalMinutos)}</Text>
          </View>
        </View>

        <Text style={estilos.seccionTitulo}>Resumen por día</Text>
        {[...dias.entries()].map(([fecha, minutos]) => (
          <View key={fecha} style={estilos.chip}>
            <Text style={estilos.chipTexto}>{formatearFecha(fecha as FechaIso)}</Text>
            <Text style={estilos.chipValor}>{formatearHorasReloj(minutos)}</Text>
          </View>
        ))}

        {parte.motivoRechazo ? (
          <View style={{ marginTop: 10 }}>
            <Text style={estilos.seccionTitulo}>Motivo del rechazo</Text>
            <Text style={estilos.celda}>{parte.motivoRechazo}</Text>
          </View>
        ) : null}

        {parte.revisorNombre ? (
          <Text style={[estilos.subtitulo, { marginTop: 8 }]}>Revisado por {parte.revisorNombre}</Text>
        ) : null}

        <View style={estilos.firma}>
          <Text style={estilos.lineaFirma}>Firma del trabajador</Text>
          <Text style={estilos.lineaFirma}>Firma de conformidad</Text>
        </View>

        <Pie titulo={`${datos.empresa} · Parte de ${parte.empleadoNombre}`} />
      </Page>
    </Document>,
  )
}
