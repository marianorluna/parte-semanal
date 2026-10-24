/**
 * Arranque del worker de informes junto al servidor Next (ADR-007).
 *
 * Next llama a `register()` una vez por instancia de servidor. El worker vive
 * en el mismo contenedor para no añadir otro servicio al stack; pg-boss usa la
 * misma PostgreSQL. Se puede desactivar con `INFORMES_WORKER=off` si un entorno
 * prefiere ejecutar la cola en un proceso aparte.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.INFORMES_WORKER === 'off') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (!process.env.DATABASE_URL) return

  const { iniciarWorkerInformes } = await import('./jobs/worker')
  void iniciarWorkerInformes().catch((error: unknown) => {
    console.error('[informes] el worker no pudo arrancar', error)
  })
}
