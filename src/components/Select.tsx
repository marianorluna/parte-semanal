'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

export type OpcionSelect = {
  valor: string
  etiqueta: string
}

type Posicion = {
  left: number
  width: number
  maxHeight: number
  arriba: boolean
  top: number
  bottom: number
}

type Props = {
  /** Texto visible sobre el control y nombre accesible del mismo. */
  etiqueta: string
  opciones: OpcionSelect[]
  /** Nombre del campo. Sin `name` el control no participa en ningún formulario. */
  name?: string
  /** Modo controlado. Si se omite, el control guarda su propio valor. */
  valor?: string
  valorInicial?: string
  requerido?: boolean
  deshabilitado?: boolean
  onChange?: (valor: string) => void
  /** Clases del disparador, equivalente al `className` de un `<select>`. */
  className?: string
  /** Clases del contenedor externo, para encaje en grids y flex. */
  classNameContenedor?: string
}

const MARGEN = 8
const ALTO_MAXIMO = 288
const ALTO_MINIMO = 96
const ESPACIO_PREFERIDO = 176

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Desplegable propio, sin dependencias. Sustituye al `<select>` nativo porque
 * su listado lo dibuja el sistema operativo y se sale del viewport en móvil.
 *
 * El panel se monta en un portal con posición fija y se abre hacia arriba o
 * hacia abajo según el hueco real, con el ancho acotado a la ventana. Encima
 * del disparador queda un `<select>` nativo transparente que conserva `name`,
 * `value`, `required` y `disabled`: formularios GET y Server Actions no cambian
 * y la validación del navegador sigue señalando el campo correcto.
 */
export function Select({
  etiqueta,
  opciones,
  name,
  valor,
  valorInicial,
  requerido = false,
  deshabilitado = false,
  onChange,
  className = '',
  classNameContenedor = '',
}: Props) {
  const idEtiqueta = useId()
  const idBoton = useId()
  const idLista = useId()
  const [interno, setInterno] = useState(valorInicial ?? '')
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const [posicion, setPosicion] = useState<Posicion | null>(null)

  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLUListElement>(null)
  const opcionesRef = useRef<(HTMLLIElement | null)[]>([])
  const bufferRef = useRef('')
  const temporizadorRef = useRef<number | null>(null)

  const actual = valor ?? interno
  const indiceSeleccionado = opciones.findIndex((opcion) => opcion.valor === actual)
  const seleccionada = indiceSeleccionado >= 0 ? opciones[indiceSeleccionado] : undefined
  const texto = seleccionada?.etiqueta ?? ''

  const calcularPosicion = useCallback(() => {
    const boton = botonRef.current
    if (!boton) return

    const rect = boton.getBoundingClientRect()
    const espacioAbajo = window.innerHeight - rect.bottom - MARGEN
    const espacioArriba = rect.top - MARGEN
    const arriba = espacioAbajo < ESPACIO_PREFERIDO && espacioArriba > espacioAbajo
    const disponible = arriba ? espacioArriba : espacioAbajo
    const ancho = Math.min(Math.max(rect.width, 200), window.innerWidth - MARGEN * 2)
    const left = Math.min(Math.max(MARGEN, rect.left), window.innerWidth - ancho - MARGEN)

    setPosicion({
      left,
      width: ancho,
      maxHeight: Math.max(ALTO_MINIMO, Math.min(ALTO_MAXIMO, disponible - 6)),
      arriba,
      top: rect.bottom + 6,
      bottom: window.innerHeight - rect.top + 6,
    })
  }, [])

  const abrir = useCallback(
    (indice: number) => {
      calcularPosicion()
      setActivo(Math.max(0, Math.min(indice, opciones.length - 1)))
      setAbierto(true)
    },
    [calcularPosicion, opciones.length],
  )

  const cerrarPanel = useCallback(() => {
    setAbierto(false)
    botonRef.current?.focus()
  }, [])

  const seleccionar = useCallback(
    (opcion: OpcionSelect) => {
      if (valor === undefined) setInterno(opcion.valor)
      onChange?.(opcion.valor)
      setAbierto(false)
      botonRef.current?.focus()
    },
    [onChange, valor],
  )

  function alternar() {
    if (deshabilitado) return
    if (abierto) {
      setAbierto(false)
      return
    }
    abrir(indiceSeleccionado >= 0 ? indiceSeleccionado : 0)
  }

  function buscarPorTexto(textoPulsado: string) {
    bufferRef.current = normalizar(bufferRef.current + textoPulsado)
    if (temporizadorRef.current !== null) window.clearTimeout(temporizadorRef.current)
    temporizadorRef.current = window.setTimeout(() => {
      bufferRef.current = ''
    }, 700)

    const indice = opciones.findIndex((opcion) => normalizar(opcion.etiqueta).startsWith(bufferRef.current))
    if (indice < 0) return
    if (abierto) setActivo(indice)
    else abrir(indice)
  }

  function alPulsarTecla(evento: KeyboardEvent<HTMLButtonElement>) {
    if (deshabilitado) return

    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      if (abierto) setActivo((indice) => Math.min(indice + 1, opciones.length - 1))
      else abrir(indiceSeleccionado >= 0 ? indiceSeleccionado : 0)
      return
    }

    if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      if (abierto) setActivo((indice) => Math.max(indice - 1, 0))
      else abrir(indiceSeleccionado >= 0 ? indiceSeleccionado : opciones.length - 1)
      return
    }

    if (evento.key === 'Home' && abierto) {
      evento.preventDefault()
      setActivo(0)
      return
    }

    if (evento.key === 'End' && abierto) {
      evento.preventDefault()
      setActivo(opciones.length - 1)
      return
    }

    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault()
      if (!abierto) {
        abrir(indiceSeleccionado >= 0 ? indiceSeleccionado : 0)
        return
      }
      const opcion = opciones[activo]
      if (opcion) seleccionar(opcion)
      return
    }

    if (evento.key === 'Escape' && abierto) {
      evento.preventDefault()
      cerrarPanel()
      return
    }

    if (evento.key === 'Tab' && abierto) {
      setAbierto(false)
      return
    }

    if (evento.key.length === 1 && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
      evento.preventDefault()
      buscarPorTexto(evento.key)
    }
  }

  // El panel es fijo: se reancla al desplazar o redimensionar.
  useEffect(() => {
    if (!abierto) return

    const alCambiarVentana = () => calcularPosicion()
    window.addEventListener('scroll', alCambiarVentana, true)
    window.addEventListener('resize', alCambiarVentana)
    return () => {
      window.removeEventListener('scroll', alCambiarVentana, true)
      window.removeEventListener('resize', alCambiarVentana)
    }
  }, [abierto, calcularPosicion])

  // Cierre al pulsar fuera del disparador y del panel.
  useEffect(() => {
    if (!abierto) return

    function alPulsar(evento: PointerEvent) {
      const objetivo = evento.target as Node
      if (panelRef.current?.contains(objetivo) || botonRef.current?.contains(objetivo)) return
      setAbierto(false)
    }

    document.addEventListener('pointerdown', alPulsar)
    return () => document.removeEventListener('pointerdown', alPulsar)
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    opcionesRef.current[activo]?.scrollIntoView({ block: 'nearest' })
  }, [abierto, activo])

  useEffect(
    () => () => {
      if (temporizadorRef.current !== null) window.clearTimeout(temporizadorRef.current)
    },
    [],
  )

  function alCambiarNativo(evento: ChangeEvent<HTMLSelectElement>) {
    const nuevo = evento.currentTarget.value
    if (valor === undefined) setInterno(nuevo)
    onChange?.(nuevo)
  }

  const panel =
    abierto && posicion ? (
      <ul
        ref={panelRef}
        id={idLista}
        role="listbox"
        aria-labelledby={idEtiqueta}
        className="fixed z-50 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5"
        style={{
          left: posicion.left,
          width: posicion.width,
          maxHeight: posicion.maxHeight,
          ...(posicion.arriba ? { bottom: posicion.bottom } : { top: posicion.top }),
        }}
      >
        {opciones.length === 0 ? (
          <li className="px-3 py-2 text-sm text-slate-500">Sin opciones</li>
        ) : (
          opciones.map((opcion, indice) => {
            const esActiva = indice === activo
            const esSeleccionada = opcion.valor === actual
            return (
              <li
                key={`${opcion.valor}-${indice}`}
                ref={(elemento) => {
                  opcionesRef.current[indice] = elemento
                }}
                id={`${idLista}-opcion-${indice}`}
                role="option"
                aria-selected={esSeleccionada}
                onPointerMove={() => setActivo(indice)}
                onClick={() => seleccionar(opcion)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                  esActiva ? 'bg-marca-50' : ''
                } ${esSeleccionada ? 'font-semibold text-marca-900' : 'text-slate-700'}`}
              >
                <span className="min-w-0 break-words">{opcion.etiqueta}</span>
                {esSeleccionada ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-marca-700"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : null}
              </li>
            )
          })
        )}
      </ul>
    ) : null

  return (
    <div className={`min-w-0 max-w-full ${classNameContenedor}`}>
      <label id={idEtiqueta} htmlFor={idBoton} className="block text-xs font-medium text-slate-600">
        {etiqueta}
      </label>
      <div className="relative mt-1 grid grid-cols-[minmax(0,1fr)]">
        <button
          ref={botonRef}
          id={idBoton}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-controls={abierto ? idLista : undefined}
          aria-labelledby={idEtiqueta}
          aria-activedescendant={
            abierto && opciones[activo] ? `${idLista}-opcion-${activo}` : undefined
          }
          aria-required={requerido || undefined}
          disabled={deshabilitado}
          onClick={alternar}
          onKeyDown={alPulsarTecla}
          title={texto || undefined}
          className={`campo flex items-center justify-between gap-2 text-left ${className}`}
        >
          <span className={`min-w-0 flex-1 truncate ${texto ? 'text-slate-900' : 'text-slate-400'}`}>
            {texto || 'Selecciona'}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${abierto ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Espejo nativo: aporta name, value, required y disabled al formulario.
            Se superpone al disparador, transparente y sin capturar clics, para
            que la validación del navegador señale exactamente este campo. */}
        {name ? (
          <select
            name={name}
            value={actual}
            onChange={alCambiarNativo}
            required={requerido}
            disabled={deshabilitado}
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          >
            {opciones.map((opcion, indice) => (
              <option key={`${opcion.valor}-${indice}`} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        ) : null}

        {panel ? createPortal(panel, document.body) : null}
      </div>
    </div>
  )
}
