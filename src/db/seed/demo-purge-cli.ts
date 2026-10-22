import 'dotenv/config'
import { sql } from '@/db/client'
import { esProduccion } from '@/config/env'
import { purgarDemo, resumenDemo } from './demo'

const argumentos = process.argv.slice(2)
const confirmado = argumentos.includes('--yes')

async function main() {
  const resumen = await resumenDemo()

  if (!resumen.existe) {
    console.log('No hay datos de demostración en la base de datos.')
    return
  }

  if (esProduccion() && !confirmado) {
    console.error(
      [
        'Entorno de PRODUCCIÓN detectado.',
        `Se van a borrar ${resumen.usuarios} usuarios y ${resumen.partes} partes de la empresa DEMO.`,
        'Repite con --yes si estás seguro:',
        '  npm run db:seed:demo:purge -- --yes',
      ].join('\n'),
    )
    process.exitCode = 1
    return
  }

  console.log(`Purgando demo: ${resumen.usuarios} usuarios y ${resumen.partes} partes...`)
  const resultado = await purgarDemo()

  console.log(
    resultado.empresaId
      ? `Demo purgado por completo (empresa ${resultado.empresaId}).`
      : 'No había datos de demostración.',
  )
}

main()
  .catch((error) => {
    console.error('[seed:demo:purge] error:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sql.end({ timeout: 5 })
  })
