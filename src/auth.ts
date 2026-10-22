import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db/client'
import { usuario } from '@/db/schema'
import { verificarPassword } from '@/modules/identidad/application/password'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'

const credencialesSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8,
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credencialesSchema.safeParse(raw)
        if (!parsed.success) return null

        const email = parsed.data.email.trim().toLowerCase()
        const filas = await db.select().from(usuario).where(eq(usuario.email, email)).limit(1)
        const encontrado = filas[0]
        if (!encontrado || !encontrado.activo) return null

        const correcta = await verificarPassword(encontrado.passwordHash, parsed.data.password)
        if (!correcta) return null

        return {
          id: encontrado.id,
          email: encontrado.email,
          name: encontrado.nombre,
          rol: encontrado.rol,
          empleadoId: encontrado.empleadoId,
          empresaId: encontrado.empresaId,
        }
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      await registrarAuditoria({
        actorId: user.id ?? null,
        entidad: 'sesion',
        entidadId: user.id ?? null,
        accion: 'LOGIN',
        despues: { email: user.email },
      })
    },
    async signOut(message) {
      const token = 'token' in message ? message.token : null
      const actorId = token?.sub ?? null
      await registrarAuditoria({
        actorId,
        entidad: 'sesion',
        entidadId: actorId,
        accion: 'LOGOUT',
      })
    },
  },
  callbacks: {
    jwt({ token, user }) {      if (user) {
        token.rol = user.rol
        token.empleadoId = user.empleadoId
        token.empresaId = user.empresaId
      }
      return token
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub
        session.user.rol = token.rol
        session.user.empleadoId = token.empleadoId
        session.user.empresaId = token.empresaId
      }
      return session
    },
  },
})
