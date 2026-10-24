import { depsEmail, depsInformes, depsIntegraciones } from '@/composition'
import {
  limpiarInformesCaducados,
  procesarInforme,
} from '@/modules/informes/application/servicio'
import { procesarEmail } from '@/modules/email/application/servicio'
import { despacharWebhooks } from '@/modules/integraciones/application/servicio'
import {
  COLA_EMAILS,
  COLA_INFORMES,
  COLA_LIMPIEZA_INFORMES,
  COLA_WEBHOOKS,
  bossCompartido,
  detenerCola,
} from './cola'

type DatosInforme = { informeId: string }
type DatosEmail = { emailId: string }

type EstadoWorker = {
  iniciado: boolean
  detenido: boolean
}

const GLOBAL = globalThis as typeof globalThis & { __workerInformes?: EstadoWorker }

function estado(): EstadoWorker {
  GLOBAL.__workerInformes ??= { iniciado: false, detenido: false }
  return GLOBAL.__workerInformes
}

/**
 * Arranca el worker de informes dentro del mismo proceso que Next (ADR-007).
 * Es idempotente: en desarrollo, el hot reload puede invocar `register` varias
 * veces y no debe multiplicar consumidores.
 */
export async function iniciarWorkerInformes(): Promise<void> {
  const actual = estado()
  if (actual.iniciado || actual.detenido) return
  actual.iniciado = true

  try {
    const { boss } = await bossCompartido()

    await boss.work<DatosInforme>(
      COLA_INFORMES,
      { batchSize: 1, pollingIntervalSeconds: 2 },
      async (jobs: Array<{ data: DatosInforme }>) => {
        for (const job of jobs) {
          try {
            await procesarInforme(depsInformes, job.data.informeId)
          } catch (error) {
            // El estado FALLIDO ya queda persistido; pg-boss reintenta el job.
            console.error('[informes] fallo al generar', job.data.informeId, error)
            throw error
          }
        }
      },
    )

    await boss.work<DatosEmail>(
      COLA_EMAILS,
      { batchSize: 5, pollingIntervalSeconds: 5 },
      async (jobs: Array<{ data: DatosEmail }>) => {
        for (const job of jobs) {
          try {
            await procesarEmail(depsEmail, job.data.emailId)
          } catch (error) {
            console.error('[email] fallo al enviar', job.data.emailId, error)
            throw error
          }
        }
      },
    )

    await boss.schedule(COLA_LIMPIEZA_INFORMES, '0 3 * * *')
    await boss.work(COLA_LIMPIEZA_INFORMES, { batchSize: 1 }, async () => {
      const eliminados = await limpiarInformesCaducados(depsInformes)
      if (eliminados > 0) console.log(`[informes] ${eliminados} informes caducados eliminados`)
    })

    await boss.schedule(COLA_WEBHOOKS, '* * * * *')
    await boss.work(COLA_WEBHOOKS, { batchSize: 1 }, async () => {
      try {
        const resumen = await despacharWebhooks(depsIntegraciones)
        if (resumen.outbox > 0 || resumen.enviadas > 0 || resumen.fallidas > 0) {
          console.log(
            `[webhooks] outbox=${resumen.outbox} enviadas=${resumen.enviadas} fallidas=${resumen.fallidas} agotadas=${resumen.agotadas}`,
          )
        }
      } catch (error) {
        // La siguiente pasada reintenta el outbox y las entregas vencidas.
        console.error('[webhooks] despacho fallido', error)
      }
    })

    // Una pasada al arrancar evita esperar hasta las 03:00 del día siguiente.
    void limpiarInformesCaducados(depsInformes).catch((error: unknown) => {
      console.error('[informes] limpieza inicial fallida', error)
    })

    const apagar = () => {
      const actual = estado()
      if (actual.detenido) return
      actual.detenido = true
      void detenerCola().catch((error: unknown) => {
        console.error('[informes] no se pudo detener la cola', error)
      })
    }

    process.once('SIGTERM', apagar)
    process.once('SIGINT', apagar)
    console.log('[informes] worker de informes iniciado')
  } catch (error) {
    actual.iniciado = false
    throw error
  }
}
