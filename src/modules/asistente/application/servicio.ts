import { AppError } from '@/shared/errors'
import type { UsuarioSesion } from '@/modules/identidad/application/sesion'
import type { SemanaIso } from '@/modules/partes/domain/fechas'
import { construirContextoBriefing, construirContextoParte } from '../domain/contexto'
import { mensajesBriefing, mensajesMotivo } from '../domain/instrucciones'
import type {
  DepsAsistente,
  FuncionAsistente,
  MensajeLLM,
  ResultadoAsistente,
} from './ports'

export const MAX_SALIDA = 1_500

/**
 * El modelo puede devolver vallas de bloque o líneas vacías de más. Se limpia
 * siempre en servidor antes de mostrarlo o de volcarlo en un formulario.
 */
export function normalizarSalida(texto: string): string {
  return texto
    .replace(/```[a-zA-Z]*\s*/g, '')
    .replace(/```/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SALIDA)
}

function exigirDisponible(deps: DepsAsistente): void {
  if (!deps.proveedor.disponible()) {
    throw new AppError(
      'NO_CONFIGURADO',
      'El asistente de IA no está configurado. Define IA_API_KEY e IA_MODELO.',
    )
  }
}

function consumirLimite(deps: DepsAsistente, usuario: UsuarioSesion): void {
  if (!deps.limite.consumir(usuario.id, deps.ahora())) {
    throw new AppError(
      'DEMASIADAS_PETICIONES',
      'Has hecho demasiadas consultas al asistente. Espera un minuto e inténtalo de nuevo.',
    )
  }
}

/**
 * Flujo común: comprobar configuración y cuota antes de consultar la base de
 * datos, llamar al proveedor, normalizar y auditar solo metadatos. Nunca se
 * guarda el prompt ni la respuesta.
 */
async function ejecutar(
  deps: DepsAsistente,
  usuario: UsuarioSesion,
  funcion: FuncionAsistente,
  construirMensajes: () => Promise<MensajeLLM[]>,
): Promise<ResultadoAsistente> {
  exigirDisponible(deps)
  consumirLimite(deps, usuario)

  const mensajes = await construirMensajes()

  let respuesta
  try {
    respuesta = await deps.proveedor.completar(mensajes)
  } catch (error) {
    // Los adaptadores ya traducen sus fallos; aquí se evita filtrar detalles.
    if (error instanceof AppError) throw error
    throw new AppError('SERVICIO_EXTERNO', 'El asistente no está disponible en este momento')
  }

  const texto = normalizarSalida(respuesta.texto)
  if (!texto) {
    throw new AppError('SERVICIO_EXTERNO', 'El asistente no devolvió una respuesta válida')
  }

  await deps.auditoria({
    actorId: usuario.id,
    entidad: 'asistente_ia',
    entidadId: usuario.id,
    accion: funcion,
    despues: {
      modelo: deps.proveedor.nombre,
      tokensEntrada: respuesta.tokensEntrada,
      tokensSalida: respuesta.tokensSalida,
    },
  })

  return { texto }
}

export async function resumirSemana(
  deps: DepsAsistente,
  usuario: UsuarioSesion,
  semana: SemanaIso,
): Promise<ResultadoAsistente> {
  return ejecutar(deps, usuario, 'BRIEFING', async () => {
    const datos = await deps.consultas.briefing(usuario, semana)
    const contexto = construirContextoBriefing(datos, { pseudonimizar: deps.pseudonimizar() })
    return mensajesBriefing(contexto)
  })
}

export async function redactarMotivoRechazo(
  deps: DepsAsistente,
  usuario: UsuarioSesion,
  parteId: string,
): Promise<ResultadoAsistente> {
  return ejecutar(deps, usuario, 'MOTIVO_RECHAZO', async () => {
    const datos = await deps.consultas.parte(usuario, parteId)
    const contexto = construirContextoParte(datos, { pseudonimizar: deps.pseudonimizar() })
    return mensajesMotivo(contexto)
  })
}
