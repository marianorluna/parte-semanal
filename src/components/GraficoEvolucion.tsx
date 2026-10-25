/**
 * Gráfico de evolución semanal en SVG puro: sin dependencias de cliente y
 * reutilizable en el dashboard y en el detalle de proyecto.
 */
export function GraficoEvolucion({
  datos,
  maximo,
  etiqueta = 'Horas por semana',
}: {
  datos: { isoYear: number; isoWeek: number; minutos: number }[]
  maximo: number
  etiqueta?: string
}) {
  if (datos.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Sin histórico.</p>
  }

  const ancho = 320
  const alto = 120
  const margen = 8
  const paso = datos.length > 1 ? (ancho - margen * 2) / (datos.length - 1) : 0

  const puntos = datos.map((fila, indice) => {
    const x = margen + indice * paso
    const y = alto - margen - (fila.minutos / Math.max(maximo, 1)) * (alto - margen * 2)
    return { x, y, ...fila }
  })

  const trazo = puntos.map((punto) => `${punto.x.toFixed(1)},${punto.y.toFixed(1)}`).join(' ')
  const area = `${margen},${alto - margen} ${trazo} ${(margen + (datos.length - 1) * paso).toFixed(1)},${alto - margen}`

  return (
    <figure className="m-0 min-w-0">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        role="img"
        aria-label={etiqueta}
        className="block h-auto w-full"
      >
        <polygon points={area} fill="rgb(0 84 83 / 0.12)" />
        <polyline points={trazo} fill="none" stroke="rgb(3 106 105)" strokeWidth="2" strokeLinejoin="round" />
        {puntos.map((punto) => (
          <circle key={`${punto.isoYear}-${punto.isoWeek}`} cx={punto.x} cy={punto.y} r="2.5" fill="rgb(0 152 120)" />
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>W{datos[0]?.isoWeek}</span>
        <span>W{datos[datos.length - 1]?.isoWeek}</span>
      </figcaption>
    </figure>
  )
}
