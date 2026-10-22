import type { Rol } from '@/db/schema'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    rol: Rol
    empleadoId: string | null
    empresaId: string
  }

  interface Session {
    user: {
      id: string
      rol: Rol
      empleadoId: string | null
      empresaId: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    rol: Rol
    empleadoId: string | null
    empresaId: string
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    rol: Rol
    empleadoId: string | null
    empresaId: string
  }
}
