import { requireUsuario } from '@/modules/identidad/application/sesion'
import { depsPartes } from '@/composition'
import { aTextoEditable } from '@/modules/partes/domain/horas'
import { hoyEnZona, nombreDia, semanaIsoDe } from '@/modules/partes/domain/fechas'
import { esEditable, semanaAnterior, semanaSiguiente } from '@/modules/partes/domain/parte'
import { obtenerSemana } from '@/modules/partes/application/servicio'
import { RejillaSemanal, type DiaSemana } from './RejillaSemanal'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ y?: string; w?: string }>
}

export default async function MiSemanaPage({ searchParams }: Props) {
  const usuario = await requireUsuario()
  const params = await searchParams

  const anio = params.y ? Number(params.y) : undefined
  const semana = params.w ? Number(params.w) : undefined

  const vista = await obtenerSemana(depsPartes, usuario, anio, semana)
  const hoy = hoyEnZona(process.env.TZ ?? 'Europe/Madrid')
  const semanaHoy = semanaIsoDe(hoy)

  const dias: DiaSemana[] = Array.from({ length: 7 }, (_, indice) => {
    const fecha = new Date(`${vista.semana.weekStart}T00:00:00.000Z`)
    fecha.setUTCDate(fecha.getUTCDate() + indice)
    const iso = fecha.toISOString().slice(0, 10)
    return { fecha: iso, dia: nombreDia(iso), esHoy: iso === hoy }
  })

  const inicial: Record<string, string> = {}
  for (const imputacion of vista.parte.imputaciones) {
    inicial[`${imputacion.fecha}|${imputacion.tareaId}`] = aTextoEditable(imputacion.minutos)
  }

  const anterior = semanaAnterior(vista.semana.isoYear, vista.semana.isoWeek)
  const siguiente = semanaSiguiente(vista.semana.isoYear, vista.semana.isoWeek)

  return (
    <RejillaSemanal
      key={`${vista.semana.isoYear}-${vista.semana.isoWeek}`}
      isoYear={vista.semana.isoYear}
      isoWeek={vista.semana.isoWeek}
      dias={dias}
      grupos={vista.grupos}
      inicial={inicial}
      versionInicial={vista.parte.version}
      estado={vista.parte.estado}
      motivoRechazo={vista.parte.motivoRechazo}
      editable={esEditable(vista.parte.estado) && Boolean(usuario.empleadoId)}
      navegacion={{
        anterior: `/mi-semana?y=${anterior.isoYear}&w=${anterior.isoWeek}`,
        siguiente: `/mi-semana?y=${siguiente.isoYear}&w=${siguiente.isoWeek}`,
        actual: `/mi-semana?y=${semanaHoy.isoYear}&w=${semanaHoy.isoWeek}`,
      }}
      nombreEmpleado={usuario.nombre}
    />
  )
}
