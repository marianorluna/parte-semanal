import { cookies } from 'next/headers'
import { requireUsuario } from '@/modules/identidad/application/sesion'
import { depsPartes } from '@/composition'
import { aTextoEditable } from '@/modules/partes/domain/horas'
import { hoyEnZona, nombreDia, semanaIsoDe } from '@/modules/partes/domain/fechas'
import { esEditable, semanaAnterior, semanaSiguiente } from '@/modules/partes/domain/parte'
import { copiaSemanaAnterior, obtenerSemana } from '@/modules/partes/application/servicio'
import { RejillaSemanal, type DiaSemana } from './RejillaSemanal'
import { COOKIE_MODO, MODO_POR_DEFECTO, esModo } from './modo'

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

  const dias: DiaSemana[] = vista.calendario.dias.map((dia) => ({
    fecha: dia.fecha,
    dia: nombreDia(dia.fecha),
    esHoy: dia.fecha === hoy,
    laborable: dia.laborable,
    motivo: dia.motivo,
    horasTeoricasMin: dia.horasTeoricasMin,
    ausencia: dia.ausencia ? { nombre: dia.ausencia.nombre, minutos: dia.ausencia.minutos } : null,
  }))

  const inicial: Record<string, string> = {}
  for (const imputacion of vista.parte.imputaciones) {
    inicial[`${imputacion.fecha}|${imputacion.tareaId}`] = aTextoEditable(imputacion.minutos)
  }

  const anterior = semanaAnterior(vista.semana.isoYear, vista.semana.isoWeek)
  const siguiente = semanaSiguiente(vista.semana.isoYear, vista.semana.isoWeek)

  const puedeEditar = esEditable(vista.parte.estado) && Boolean(usuario.empleadoId)
  const copia = puedeEditar
    ? await copiaSemanaAnterior(depsPartes, usuario, vista.semana)
    : { origen: null, filas: [], totalMinutos: 0, omitidas: 0 }

  const preferida = (await cookies()).get(COOKIE_MODO)?.value
  const modoInicial = esModo(preferida) ? preferida : MODO_POR_DEFECTO

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
      calendario={{
        capacidadMin: vista.calendario.capacidadMin,
        porDefecto: vista.calendario.porDefecto,
      }}
      semanaCerrada={vista.semana.weekEnd < hoy}
      editable={puedeEditar}
      modoInicial={modoInicial}
      copiaSemanaAnterior={{
        origen: copia.origen,
        lineas: copia.filas.length,
        filas: copia.filas.map((fila) => ({
          fecha: fila.fecha,
          tareaId: fila.tareaId,
          minutos: fila.minutos,
        })),
        totalMinutos: copia.totalMinutos,
        omitidas: copia.omitidas,
      }}
      navegacion={{
        anterior: `/mi-semana?y=${anterior.isoYear}&w=${anterior.isoWeek}`,
        siguiente: `/mi-semana?y=${siguiente.isoYear}&w=${siguiente.isoWeek}`,
        actual: `/mi-semana?y=${semanaHoy.isoYear}&w=${semanaHoy.isoWeek}`,
      }}
      nombreEmpleado={usuario.nombre}
    />
  )
}
