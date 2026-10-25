import 'dotenv/config'
import { sql } from '@/db/client'
import { esProduccion } from '@/config/env'
import { CUENTAS_ACCESO_RAPIDO } from '@/modules/identidad/application/cuentas-demo'
import { cargarDemo, purgarDemo, resumenDemo } from './demo'

const argumentos = process.argv.slice(2)
const refrescar = argumentos.includes('--refresh')
const confirmado = argumentos.includes('--yes')

async function main() {
  const estadoInicial = await resumenDemo()

  if (estadoInicial.existe && !refrescar) {
    console.log(
      [
        `La demo ya está cargada: ${estadoInicial.usuarios} usuarios, ${estadoInicial.partes} partes e ` +
          `${estadoInicial.informes} informes.`,
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
      `  calendarios: ${resumen.calendarios} (${resumen.festivos} festivos)`,
      `  convenios: ${resumen.convenios}`,
      `  tarifas: ${resumen.tarifas}`,
      `  ausencias: ${resumen.ausencias}`,
      `  presupuestos: ${resumen.presupuestos}`,
      `  cierres: ${resumen.cierres}`,
      `  informes: ${resumen.informes}`,
      `  avisos: ${resumen.avisos}, correos: ${resumen.correos}`,
      `  claves API: ${resumen.clavesApi}, webhooks: ${resumen.webhooks}`,
      '',
      `Contraseña común: ${process.env.DEMO_PASSWORD ?? 'Demo1234!'}`,
      ...CUENTAS_ACCESO_RAPIDO.map((cuenta) => `${cuenta.etiqueta}: ${cuenta.nombre} <${cuenta.email}>`),
      'Resto de cuentas: inicial+apellido@levitec.es (misma contraseña)',
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
