'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { depsPartes } from '@/composition'
import { autorizar } from '@/modules/identidad/application/sesion'
import { enviarSemana, guardarSemana } from '@/modules/partes/application/servicio'
import { fallo, ok, type Respuesta } from '@/shared/errors'

const filaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  tareaId: z.string().uuid('Tarea inválida'),
  minutos: z.number().int().min(0).max(1440),
})

const guardarSchema = z.object({
  isoYear: z.number().int().min(2000).max(2100),
  isoWeek: z.number().int().min(1).max(53),
  version: z.number().int().positive(),
  filas: z.array(filaSchema).max(200),
})

export async function guardarSemanaAction(input: unknown): Promise<Respuesta<{ version: number }>> {
  try {
    const usuario = await autorizar('TRABAJADOR', 'ENCARGADO', 'ADMIN')
    const datos = guardarSchema.parse(input)
    const version = await guardarSemana(depsPartes, usuario, datos)
    revalidatePath('/mi-semana')
    return ok({ version })
  } catch (error) {
    return fallo(error)
  }
}

const enviarSchema = z.object({
  isoYear: z.number().int().min(2000).max(2100),
  isoWeek: z.number().int().min(1).max(53),
  version: z.number().int().positive(),
  // La obligatoriedad depende de la semana y del calendario: el servicio es
  // quien decide si falta. Aquí solo se acota el tamaño.
  motivoDesviacion: z.string().trim().max(500).optional(),
})

export async function enviarSemanaAction(input: unknown): Promise<Respuesta<{ enviado: true }>> {
  try {
    const usuario = await autorizar('TRABAJADOR', 'ENCARGADO', 'ADMIN')
    const datos = enviarSchema.parse(input)
    await enviarSemana(depsPartes, usuario, datos)
    revalidatePath('/mi-semana')
    revalidatePath('/control/partes')
    return ok({ enviado: true as const })
  } catch (error) {
    return fallo(error)
  }
}
