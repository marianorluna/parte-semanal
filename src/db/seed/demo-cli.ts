import 'dotenv/config'
import { sql } from '@/db/client'
import { esProduccion } from '@/config/env'
import { cargarDemo, purgarDemo, resumenDemo } from './demo'

const argumentos = process.argv.slice(2)
const refrescar = argumentos.includes('--refresh')
const confirmado = argumentos.includes('--yes')

async function main() {
  const estadoInicial = await resumenDemo()

  if (estadoInicial.existe && !refrescar) {
    console.log(
      [
        `La demo ya está cargada: ${estadoInicial.usuarios} usuarios y ${estadoInicial.partes} partes.`,
        'Nada que hacer. Usa --refresh para purgarla y volver a generarla:',
        '  npm run db:seed:demo -- --refresh',
      ].join('\n'),
    )
    return
  }

  if (esProduccion() && !confirmado) {
    console.error(
      [
        'Entorno de PRODUCCIÓN detectado.',
        'Esta orden crea datos de demostración en la base de datos real.',
        'Repite con --yes si estás seguro:',
        '  npm run db:seed:demo -- --yes',
        refrescar ? '  (con --refresh se purga antes lo que ya exista de DEMO)' : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    process.exitCode = 1
    return
  }

  if (refrescar) {
    const purgado = await purgarDemo()
    console.log(
      purgado.empresaId
        ? `Demo anterior purgado: ${purgado.usuarios} usuarios y ${purgado.partes} partes.`
        : 'No había datos de demo que purgar.',
    )
  }

  console.log('Cargando datos de demostración...')
  const resumen = await cargarDemo({ refrescar: false })

  console.log(
    [
      'Demo cargado:',
      `  empresa: ${resumen.empresaId}`,
      `  usuarios: ${resumen.usuarios}`,
      `  empleados: ${resumen.empleados}`,
      `  proyectos: ${resumen.proyectos} (${resumen.tareas} tareas)`,
      `  partes: ${resumen.partes} en ${resumen.semanas} semanas`,
      `  imputaciones: ${resumen.imputaciones}`,
      '',
      `Acceso administrador: admin@demo.local / ${process.env.DEMO_PASSWORD ?? 'Demo1234!'}`,
      'Encargados: encargado1@demo.local ... encargado6@demo.local',
      'Trabajadores: trabajador01@demo.local ... trabajador43@demo.local',
    ].join('\n'),
  )
}

main()
  .catch((error) => {
    console.error('[seed:demo] error:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sql.end({ timeout: 5 })
  })
