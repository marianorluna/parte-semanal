'use client'

import { useActionState, useEffect, useRef } from 'react'
import type { CuentaAccesoRapido } from '@/modules/identidad/application/cuentas-demo'
import { iniciarSesionRapida, type EstadoLogin } from './actions'

const estadoInicial: EstadoLogin = {}

/**
 * Altura mínima (px) para arrancar con los botones desplegados. Con los textos
 * auxiliares retirados, el login completo mide unos 650 px, así que la mayoría
 * de móviles en vertical los muestran sin scroll. Por debajo se pliegan.
 */
const ALTO_DESPLEGADO = 660

type Props = { cuentas: readonly CuentaAccesoRapido[] }

/**
 * Botones provisionales para revisar la app sin escribir credenciales. La
 * contraseña se aplica en la Server Action, nunca en el cliente. Se pliega en
 * pantallas bajas para no empujar el formulario fuera de la ventana.
 */
export function AccesoRapido({ cuentas }: Props) {
  const [estado, accion, pendiente] = useActionState(iniciarSesionRapida, estadoInicial)
  const panel = useRef<HTMLDetailsElement>(null)
  const abiertoPorElUsuario = useRef(false)

  useEffect(() => {
    const elemento = panel.current
    if (!elemento) return

    const consulta = window.matchMedia(`(min-height: ${ALTO_DESPLEGADO}px)`)
    const aplicar = () => {
      if (!abiertoPorElUsuario.current) elemento.open = consulta.matches
    }

    aplicar()
    consulta.addEventListener('change', aplicar)
    return () => consulta.removeEventListener('change', aplicar)
  }, [])

  // Un error de acceso debe ser visible aunque el bloque esté plegado.
  useEffect(() => {
    if (!estado.error || !panel.current) return
    abiertoPorElUsuario.current = true
    panel.current.open = true
  }, [estado.error])

  if (cuentas.length === 0) return null

  return (
    <details
      ref={panel}
      className="group relative mt-4 rounded-xl border border-dashed border-acento-500/60 bg-acento-950/40 p-3 [@media(max-height:46rem)]:mt-3 [@media(max-height:32rem)]:p-2"
    >
      {/* Plegado: título centrado. Desplegado: el título desaparece y queda solo
          el chevron sobre el borde, para que el padding superior iguale al
          lateral. El texto se conserva para lectores de pantalla. */}
      <summary
        onClick={() => {
          abiertoPorElUsuario.current = true
        }}
        className="flex cursor-pointer list-none items-center justify-center gap-1.5 text-[11px] font-semibold tracking-wide text-acento-300 uppercase select-none [&::-webkit-details-marker]:hidden group-open:absolute group-open:top-0 group-open:left-1/2 group-open:z-10 group-open:-translate-x-1/2 group-open:-translate-y-1/2 group-open:rounded-full group-open:border group-open:border-dashed group-open:border-acento-500/60 group-open:bg-marca-900 group-open:px-2 group-open:py-0.5 after:absolute after:-inset-2 after:content-[''] group-open:transition-colors group-open:hover:border-acento-300"
      >
        <span className="group-open:sr-only">Acceso rápido (entorno de pruebas)</span>
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <form action={accion} className="mt-2 space-y-2 group-open:mt-0">
        {cuentas.map((cuenta) => (
          <button
            key={cuenta.clave}
            type="submit"
            name="cuenta"
            value={cuenta.clave}
            disabled={pendiente}
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-acento-500/80 bg-acento-800/80 px-3 py-2 text-left text-sm text-white shadow-sm transition-colors hover:border-acento-300 hover:bg-acento-700/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="shrink-0 text-left">
              <span className="block font-semibold">{cuenta.etiqueta}</span>
              <span className="block text-[11px] font-normal text-acento-200">{cuenta.nombre}</span>
            </span>
            <span className="min-w-0 truncate text-xs text-acento-200">{cuenta.email}</span>
          </button>
        ))}
      </form>

      {estado.error ? (
        <p role="alert" className="mt-2 rounded-md bg-red-950/60 px-3 py-2 text-center text-xs text-red-200">
          {estado.error}
        </p>
      ) : null}
    </details>
  )
}
