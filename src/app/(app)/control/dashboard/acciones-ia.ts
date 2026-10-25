'use server'

import { z } from 'zod'
import { depsAsistente } from '@/composition'
import { autorizar } from '@/modules/identidad/application/sesion'
import { resumirSemana } from '@/modules/asistente/application/servicio'
import { semanaIso } from '@/modules/partes/domain/fechas'
import { aResultadoIA, type ResultadoIA } from '../resultado-ia'

const esquema = z.object({
  isoYear: z.number().int().min(2000).max(2100),
  isoWeek: z.number().int().min(1).max(53),
})

export async function resumirSemanaAction(input: unknown): Promise<ResultadoIA> {
  try {
    const usuario = await autorizar('ENCARGADO', 'ADMIN')
    const datos = esquema.parse(input)
    const semana = semanaIso(datos.isoYear, datos.isoWeek)
    const { texto } = await resumirSemana(depsAsistente, usuario, semana)
    return { ok: true, texto }
  } catch (error) {
    return aResultadoIA(error)
  }
}
