import type { Metadata, Viewport } from 'next'
import { MARCA } from '@/config/marca'
import './globals.css'

export const metadata: Metadata = {
  title: `${MARCA.nombre} - Parte semanal de horas`,
  description: 'Registro y control de horas imputadas a proyecto',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#043a39',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
