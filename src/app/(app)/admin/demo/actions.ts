'use server'

import { revalidatePath } from 'next/cache'
import { autorizar } from '@/modules/identidad/application/sesion'
import { cargarDemo, purgarDemo } from '@/db/seed/demo'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'

export type EstadoDemo = { error?: string; ok?: string; detalle?: string }

export async function cargarDemoAction(_prev: EstadoDemo, formData: FormData): Promise<EstadoDemo> {
  const confirmacion = String(formData.get('confirmacion') ?? '').trim().toUpperCase()

  try {
    const actor = await autorizar('ADMIN')
    if (confirmacion !== 'CARGAR') {
      return { error: 'Escribe CARGAR en el campo de confirmación' }
    }

    const resumen = await cargarDemo({ refrescar: true })

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'demo',
      accion: 'CARGAR_DEMO',
      despues: {
        usuarios: resumen.usuarios,
        partes: resumen.partes,
        informes: resumen.informes,
        cierres: resumen.cierres,
      },
    })

    revalidatePath('/admin/demo')
    revalidatePath('/admin/usuarios')
    revalidatePath('/control/dashboard')
    revalidatePath('/control/partes')
    revalidatePath('/control/proyectos')
    revalidatePath('/notificaciones')
    revalidatePath('/admin/informes')
    revalidatePath('/admin/cierres')

    return {
      ok: 'Datos de demostración cargados',
      detalle:
        `${resumen.usuarios} usuarios, ${resumen.proyectos} proyectos y ${resumen.partes} partes ` +
        `(${resumen.imputaciones} imputaciones en ${resumen.semanas} semanas). Fase 2: ` +
        `${resumen.calendarios} calendarios, ${resumen.convenios} convenios, ${resumen.ausencias} ausencias, ` +
        `${resumen.cierres} cierres e ${resumen.informes} informes.`,
    }
  } catch (error) {
    console.error('[admin/demo] cargar', error)
    return { error: error instanceof Error ? error.message : 'No se pudo cargar el demo' }
  }
}

export async function purgarDemoAction(_prev: EstadoDemo, formData: FormData): Promise<EstadoDemo> {
  const confirmacion = String(formData.get('confirmacion') ?? '').trim().toUpperCase()

  try {
    const actor = await autorizar('ADMIN')
    if (confirmacion !== 'PURGAR') {
      return { error: 'Escribe PURGAR en el campo de confirmación' }
    }

    const resultado = await purgarDemo()

    await registrarAuditoria({
      actorId: actor.id,
      entidad: 'demo',
      accion: 'PURGAR_DEMO',
      despues: { partes: resultado.partes, usuarios: resultado.usuarios },
    })

    revalidatePath('/admin/demo')
    revalidatePath('/admin/usuarios')
    revalidatePath('/control/dashboard')
    revalidatePath('/control/partes')
    revalidatePath('/control/proyectos')
    revalidatePath('/notificaciones')
    revalidatePath('/admin/informes')
    revalidatePath('/admin/cierres')

    return resultado.empresaId
      ? {
          ok: 'Datos de demostración purgados',
          detalle: `Se han borrado ${resultado.usuarios} usuarios y ${resultado.partes} partes de la empresa DEMO.`,
        }
      : { ok: 'No había datos de demostración' }
  } catch (error) {
    console.error('[admin/demo] purgar', error)
    return { error: error instanceof Error ? error.message : 'No se pudo purgar el demo' }
  }
}
