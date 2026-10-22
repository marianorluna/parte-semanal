'use client'

export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="boton-primario">
      Imprimir o guardar PDF
    </button>
  )
}
