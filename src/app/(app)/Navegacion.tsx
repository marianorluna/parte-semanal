'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as KeyboardEventReact,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  contadorVisible,
  esGrupo,
  estaActivo,
  grupoActivo,
  type ItemNav,
} from './navegacion-modelo'
import { Icono, type NombreIcono } from '@/components/Iconos'
import { Marca } from '@/components/Marca'

export type { EnlaceNav, GrupoNav, ItemNav } from './navegacion-modelo'

/** Icono de cada sección; el mapa evita tocar el modelo de navegación. */
const ICONOS_RUTA: Record<string, NombreIcono> = {
  '/mi-semana': 'calendario',
  '/mis-ausencias': 'reloj',
  '/control/dashboard': 'grafico',
  '/control/partes': 'bandeja',
  '/control/equipo': 'usuarios',
  '/control/ausencias': 'reloj',
  '/control/proyectos': 'alerta',
  '/admin/usuarios': 'usuarios',
  '/admin/proyectos': 'hoja',
  '/admin/calendario': 'calendario',
  '/admin/convenios': 'documento',
  '/admin/ausencias': 'reloj',
  '/admin/costes': 'grafico',
  '/admin/informes': 'documento',
  '/admin/cierres': 'reloj',
  '/admin/emails': 'campana',
  '/admin/api': 'documento',
  '/admin/auditoria': 'lupa',
  '/admin/demo': 'rayo',
}

const ICONOS_GRUPO: Record<string, NombreIcono> = {
  Control: 'bandeja',
  Configuración: 'documento',
  Análisis: 'grafico',
  Sistema: 'campana',
}

function iconoDeRuta(href: string): NombreIcono {
  return ICONOS_RUTA[href] ?? 'documento'
}

function iconoDeGrupo(etiqueta: string): NombreIcono {
  return ICONOS_GRUPO[etiqueta] ?? 'documento'
}

function Contador({ valor }: { valor?: number }) {
  if (!valor || valor <= 0) return null
  return (
    <span className="rounded-full bg-acento-400 px-1.5 py-0.5 text-[11px] font-bold text-marca-950">
      {valor}
    </span>
  )
}

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/** Clave estable de cada grupo; no depende del contenido ni del orden de las rutas. */
function claveGrupo(indice: number): string {
  return `menu-grupo-${indice}`
}

/** Barra horizontal de escritorio. Por debajo de `lg` se usa el drawer. */
export function NavegacionEscritorio({ items }: { items: ItemNav[] }) {
  const ruta = usePathname()
  // Guardar la ruta junto a la clave cierra el desplegable al navegar sin efectos.
  const [abiertoEn, setAbiertoEn] = useState<{ clave: string; ruta: string } | null>(null)
  const abierto = abiertoEn?.ruta === ruta ? abiertoEn.clave : null
  const navRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const disparadoresRef = useRef(new Map<string, HTMLButtonElement>())
  const focoPendiente = useRef(false)

  const cerrar = useCallback(() => setAbiertoEn(null), [])

  useEffect(() => {
    if (!abierto) return
    const claveAbierta = abierto

    function alPulsarFuera(evento: MouseEvent) {
      if (navRef.current && !navRef.current.contains(evento.target as Node)) cerrar()
    }

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      disparadoresRef.current.get(claveAbierta)?.focus()
      cerrar()
    }

    document.addEventListener('mousedown', alPulsarFuera)
    document.addEventListener('keydown', alPulsarTecla)
    return () => {
      document.removeEventListener('mousedown', alPulsarFuera)
      document.removeEventListener('keydown', alPulsarTecla)
    }
  }, [abierto, cerrar])

  useEffect(() => {
    if (!abierto || !focoPendiente.current) return
    focoPendiente.current = false
    panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus()
  }, [abierto])

  /** Navegación de teclado dentro del panel y cierre al salir con Tab. */
  function alPulsarEnPanel(evento: KeyboardEventReact<HTMLDivElement>) {
    if (!panelRef.current) return
    const enfocables = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href]'))
    const primero = enfocables[0]
    const ultimo = enfocables[enfocables.length - 1]
    if (!primero || !ultimo) return

    if (evento.key === 'Tab') {
      if (evento.shiftKey && document.activeElement === primero) cerrar()
      else if (!evento.shiftKey && document.activeElement === ultimo) cerrar()
      return
    }

    const actual = enfocables.indexOf(document.activeElement as HTMLElement)

    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      const siguiente = enfocables[actual + 1] ?? primero
      siguiente.focus()
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      const anterior = enfocables[actual - 1] ?? ultimo
      anterior.focus()
    } else if (evento.key === 'Home') {
      evento.preventDefault()
      primero.focus()
    } else if (evento.key === 'End') {
      evento.preventDefault()
      ultimo.focus()
    }
  }

  return (
    <nav
      ref={navRef}
      aria-label="Navegación principal"
      className="hidden items-center gap-1 lg:flex"
    >
      {items.map((item, indice) => {
        if (!esGrupo(item)) {
          const activo = estaActivo(ruta, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
                activo
                  ? 'bg-white font-semibold text-marca-900 shadow-sm'
                  : 'font-medium text-marca-100 hover:bg-marca-800 hover:text-white'
              }`}
            >
              {item.etiqueta}
              <Contador valor={item.contador} />
            </Link>
          )
        }

        const clave = claveGrupo(indice)
        const expandido = abierto === clave
        const activo = grupoActivo(ruta, item)
        const panelId = `${clave}-panel`

        return (
          <div key={clave} className="relative">
            <button
              type="button"
              ref={(nodo) => {
                if (nodo) disparadoresRef.current.set(clave, nodo)
                else disparadoresRef.current.delete(clave)
              }}
              aria-haspopup="menu"
              aria-expanded={expandido}
              aria-controls={expandido ? panelId : undefined}
              aria-current={activo ? 'true' : undefined}
              onClick={() => setAbiertoEn(expandido ? null : { clave, ruta })}
              onKeyDown={(evento) => {
                if (evento.key !== 'ArrowDown') return
                evento.preventDefault()
                if (expandido) {
                  panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus()
                  return
                }
                focoPendiente.current = true
                setAbiertoEn({ clave, ruta })
              }}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
                expandido
                  ? 'bg-marca-800 font-semibold text-white'
                  : activo
                    ? 'bg-marca-800 font-semibold text-white'
                    : 'font-medium text-marca-100 hover:bg-marca-800 hover:text-white'
              }`}
            >
              {item.etiqueta}
              <Contador valor={contadorVisible(item)} />
              <Chevron abierto={expandido} />
            </button>

            {expandido ? (
              <div
                ref={panelRef}
                id={panelId}
                role="menu"
                aria-label={item.etiqueta}
                onKeyDown={alPulsarEnPanel}
                className="absolute top-full left-0 z-20 mt-1 min-w-72 rounded-lg border border-marca-700 bg-marca-900 p-2 shadow-xl"
              >
                {item.enlaces.map((enlace) => {
                  const enlaceActivo = estaActivo(ruta, enlace.href)
                  return (
                    <Link
                      key={enlace.href}
                      href={enlace.href}
                      role="menuitem"
                      aria-current={enlaceActivo ? 'page' : undefined}
                      className={`flex items-start justify-between gap-3 rounded-md px-3 py-2 transition-colors ${
                        enlaceActivo
                          ? 'bg-white text-marca-900 shadow-sm'
                          : 'text-marca-100 hover:bg-marca-800 hover:text-white'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{enlace.etiqueta}</span>
                        {enlace.descripcion ? (
                          <span className="mt-0.5 block text-xs leading-snug opacity-70">
                            {enlace.descripcion}
                          </span>
                        ) : null}
                      </span>
                      <Contador valor={enlace.contador} />
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}

/**
 * Panel lateral completo. Lo usan la cabecera (desde `md`) y la barra inferior
 * móvil, así que se monta solo cuando está abierto y devuelve el foco al
 * llamador con `onCerrar`.
 */
export function PanelMenu({
  items,
  onCerrar,
  usuario,
  cerrarSesion,
}: {
  items: ItemNav[]
  onCerrar: () => void
  usuario: { nombre: string; rol: string }
  cerrarSesion: () => Promise<void>
}) {
  const ruta = usePathname()
  // Al abrir, despliega solo las secciones que contienen la página actual.
  const [gruposAbiertos, setGruposAbiertos] = useState<string[]>(() =>
    items.flatMap((item, indice) => (esGrupo(item) && grupoActivo(ruta, item) ? [claveGrupo(indice)] : [])),
  )
  const panelRef = useRef<HTMLDivElement>(null)

  function alternarGrupo(clave: string) {
    setGruposAbiertos((anteriores) =>
      anteriores.includes(clave)
        ? anteriores.filter((otra) => otra !== clave)
        : [...anteriores, clave],
    )
  }

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus()

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        onCerrar()
        return
      }
      if (evento.key !== 'Tab' || !panelRef.current) return

      const enfocables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ).filter((elemento) => elemento.offsetParent !== null)
      if (enfocables.length === 0) return

      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      if (!primero || !ultimo) return

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPulsarTecla)
    return () => {
      document.removeEventListener('keydown', alPulsarTecla)
      document.body.style.overflow = anterior
    }
  }, [onCerrar])

  const directos = items.flatMap((item) => (esGrupo(item) ? [] : [item]))
  const grupos = items.flatMap((item, indice) => (esGrupo(item) ? [{ grupo: item, indice }] : []))
  const inicial = usuario.nombre.trim().charAt(0).toUpperCase()

  const panel = (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCerrar}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/60"
      />
      <div
        ref={panelRef}
        id="menu-navegacion"
        role="dialog"
        aria-modal="true"
        aria-label="Navegación principal"
        className="absolute inset-y-0 right-0 flex w-80 max-w-[88vw] flex-col bg-linear-to-b from-marca-800 via-marca-900 to-marca-950 pb-[env(safe-area-inset-bottom)] text-white shadow-2xl ring-1 ring-white/10"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <Marca className="text-xs" />
            <p className="mt-0.5 text-[11px] font-semibold tracking-widest text-marca-300 uppercase">
              Navegación
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-marca-200 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar menú"
          >
            <Icono nombre="cerrar" className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acento-500/20 text-sm font-bold text-acento-200 ring-1 ring-acento-400/40"
            >
              {inicial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{usuario.nombre}</p>
              <p className="text-xs text-marca-300">{usuario.rol}</p>
            </div>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="scroll-oscuro flex-1 space-y-3 overflow-y-auto p-3">
          {directos.length > 0 ? (
            <ul className="overflow-hidden rounded-lg border border-white/10 bg-white/5 p-1">
              {directos.map((item) => {
                const activo = estaActivo(ruta, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onCerrar}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                        activo
                          ? 'bg-acento-500/15 font-semibold text-white ring-1 ring-acento-400/50 ring-inset'
                          : 'font-medium text-marca-100 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icono
                        nombre={iconoDeRuta(item.href)}
                        className={`h-4 w-4 ${activo ? 'text-acento-300' : 'text-marca-300'}`}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.etiqueta}</span>
                      <Contador valor={item.contador} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {grupos.map(({ grupo, indice }) => {
            const clave = claveGrupo(indice)
            const expandido = gruposAbiertos.includes(clave)
            const panelId = `${clave}-movil`
            const activo = grupoActivo(ruta, grupo)

            return (
              <div key={clave} className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
                <button
                  type="button"
                  aria-expanded={expandido}
                  aria-controls={expandido ? panelId : undefined}
                  aria-current={activo ? 'true' : undefined}
                  onClick={() => alternarGrupo(clave)}
                  className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-white/5 ${
                    activo ? 'text-acento-200' : 'text-marca-200'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icono nombre={iconoDeGrupo(grupo.etiqueta)} className="h-4 w-4 shrink-0" />
                    <span className="truncate text-[11px] font-bold tracking-widest uppercase">
                      {grupo.etiqueta}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Contador valor={contadorVisible(grupo)} />
                    <Chevron abierto={expandido} />
                  </span>
                </button>

                {expandido ? (
                  <div id={panelId} className="space-y-0.5 border-t border-white/10 p-1">
                    {grupo.enlaces.map((enlace) => {
                      const enlaceActivo = estaActivo(ruta, enlace.href)
                      return (
                        <Link
                          key={enlace.href}
                          href={enlace.href}
                          onClick={onCerrar}
                          aria-current={enlaceActivo ? 'page' : undefined}
                          className={`flex min-h-11 flex-col justify-center gap-0.5 rounded-md px-2.5 py-2 transition-colors ${
                            enlaceActivo
                              ? 'bg-acento-500/15 text-white ring-1 ring-acento-400/50 ring-inset'
                              : 'text-marca-100 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2 text-sm font-medium">
                            <span className="flex min-w-0 items-center gap-2">
                              <Icono
                                nombre={iconoDeRuta(enlace.href)}
                                className={`h-4 w-4 shrink-0 ${
                                  enlaceActivo ? 'text-acento-300' : 'text-marca-300'
                                }`}
                              />
                              <span className="truncate">{enlace.etiqueta}</span>
                            </span>
                            <Contador valor={enlace.contador} />
                          </span>
                          {enlace.descripcion ? (
                            <span className="pl-6 text-xs leading-snug text-marca-300">{enlace.descripcion}</span>
                          ) : null}
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-white/15 px-3 text-sm font-semibold text-marca-100 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icono nombre="salir" />
              Salir
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}

/** Botón de menú de la cabecera (desde `md`). */
export function MenuNavegacion({
  items,
  usuario,
  cerrarSesion,
}: {
  items: ItemNav[]
  usuario: { nombre: string; rol: string }
  cerrarSesion: () => Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const botonRef = useRef<HTMLButtonElement>(null)

  function cerrar() {
    setAbierto(false)
    botonRef.current?.focus()
  }

  return (
    <div className="hidden md:block">
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto(true)}
        aria-expanded={abierto}
        aria-controls="menu-navegacion"
        aria-label="Abrir menú"
        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-marca-600 text-white transition-colors hover:bg-marca-800"
      >
        <Icono nombre="menu" className="h-5 w-5" />
      </button>

      {abierto ? (
        <PanelMenu items={items} onCerrar={cerrar} usuario={usuario} cerrarSesion={cerrarSesion} />
      ) : null}
    </div>
  )
}
