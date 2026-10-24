'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { depsPartes, depsComputo, depsCoste } from '@/composition'
import { autorizar } from '@/modules/identidad/application/sesion'
import { aprobarSemana, rechazarSemana, reabrirSemana } from '@/modules/partes/application/servicio'
import { computarParte } from '@/modules/computo/application/servicio'
import { costearParte } from '@/modules/coste/application/servicio'
import { fallo, ok, type Respuesta } from '@/shared/errors'

const itemSchema = z.object({
  parteId: z.string().uuid(),
  version: z.number().int().positive(),
})

const rechazochema = itemSchema.extend({
  motivo: z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres'),
})

export type ResultadoLote = {
  aprobados: number
  fallidos: { parteId: string; mensaje: string }[]
}

export async function aprobarParteAction(input: unknown): Promise<Respuesta<{ aprobado: true }>> {
  try {
    const usuario = await autorizar('ENCARGADO', 'ADMIN')
    const datos = itemSchema.parse(input)
    await aprobarSemana(depsPartes, usuario, datos)
    revalidatePath('/control/partes')
    revalidatePath('/control/dashboard')
    return ok({ aprobado: true as const })
  } catch (error) {
    return fallo(error)
  }
}

export async function rechazarParteAction(input: unknown): Promise<Respuesta<{ rechazado: true }>> {
  try {
    const usuario = await autorizar('ENCARGADO', 'ADMIN')
    const datos = rechazochema.parse(input)
    await rechazarSemana(depsPartes, usuario, datos)
    revalidatePath('/control/partes')
    revalidatePath('/control/dashboard')
    return ok({ rechazado: true as const })
  } catch (error) {
    return fallo(error)
  }
}

export async function reabrirParteAction(input: unknown): Promise<Respuesta<{ reabierto: true }>> {
  try {
    const usuario = await autorizar('ENCARGADO', 'ADMIN')
    const datos = rechazochema.parse(input)
    await reabrirSemana(depsPartes, usuario, datos)
    revalidatePath('/control/partes')
    revalidatePath('/control/dashboard')
    return ok({ reabierto: true as const })
  } catch (error) {
    return fallo(error)
  }
}

const lotechema = z.object({
  partes: z.array(itemSchema).min(1).max(100),
})

export async function aprobarLoteAction(input: unknown): Promise<Respuesta<ResultadoLote>> {
  try {
    const usuario = await autorizar('ENCARGADO', 'ADMIN')
    const datos = lotechema.parse(input)

    let aprobados = 0
    const fallidos: ResultadoLote['fallidos'] = []

    for (const item of datos.partes) {
      try {
        await aprobarSemana(depsPartes, usuario, item)
        aprobados += 1
      } catch (error) {
        fallidos.push({
          parteId: item.parteId,
          mensaje: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    }

    revalidatePath('/control/partes')
    revalidatePath('/control/dashboard')
    return ok({ aprobados, fallidos })
  } catch (error) {
    return fallo(error)
  }
}

export async function recalcularComputoAction(
  input: unknown,
): Promise<Respuesta<{ minutosBase: number; minutosComputados: number; totalCents: number }>> {
  try {
    const usuario = await autorizar('ADMIN')
    const datos = z.object({ parteId: z.string().uuid() }).parse(input)
    void usuario

    const resultado = await computarParte(depsComputo, datos.parteId)
    const coste = await costearParte(depsCoste, datos.parteId)
    revalidatePath(`/control/partes/${datos.parteId}`)
    return ok({
      minutosBase: resultado.resumen.minutosBase,
      minutosComputados: resultado.resumen.minutosComputados,
      totalCents: coste.totalCents,
    })
  } catch (error) {
    return fallo(error)
  }
}
