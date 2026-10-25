import type { DepsPartes } from '@/modules/partes/application/servicio'
import { repositorioPartes } from '@/modules/partes/infrastructure/repositorio'
import { proyectosDeParte, proyectosPermitidos } from '@/modules/identidad/infrastructure/repositorio-identidad'
import { obtenerSemanaCalendario } from '@/modules/calendario/application/servicio'
import { textoMotivo } from '@/modules/calendario/domain/calendario'
import { repositorioCalendario } from '@/modules/calendario/infrastructure/repositorio'
import { computarParte, type DepsComputo } from '@/modules/computo/application/servicio'
import { repositorioComputo } from '@/modules/computo/infrastructure/repositorio'
import { costearParte, type DepsCoste } from '@/modules/coste/application/servicio'
import { repositorioCoste } from '@/modules/coste/infrastructure/repositorio'
import { ausenciasDeSemana, type DepsAusencias } from '@/modules/ausencias/application/servicio'
import {
  aplicarAusenciasADias,
  capacidadDeDias,
  type CapacidadDia,
} from '@/modules/ausencias/domain/ausencia'
import { repositorioAusencias } from '@/modules/ausencias/infrastructure/repositorio'
import { consultasInformes } from '@/modules/informes/infrastructure/consultas'
import type { DepsInformes } from '@/modules/informes/application/ports'
import { repositorioInformes } from '@/modules/informes/infrastructure/repositorio'
import { repositorioCierre } from '@/modules/cierre/infrastructure/repositorio'
import { fechasBloqueadas, type DepsCierre } from '@/modules/cierre/application/servicio'
import { repositorioEmail } from '@/modules/email/infrastructure/repositorio'
import { enviarEmail, smtpConfigurado } from '@/modules/email/infrastructure/smtp'
import type { DepsEmail } from '@/modules/email/application/servicio'
import { encolarEmail, encolarInforme } from '@/jobs/cola'
import { semanaIsoDe, sumarDias, type FechaIso } from '@/modules/partes/domain/fechas'
import type { DepsAvisos } from '@/modules/notificaciones/application/servicio'
import { consultasAvisos } from '@/modules/notificaciones/infrastructure/consultas'
import { repositorioNotificaciones } from '@/modules/notificaciones/infrastructure/repositorio'
import { repositorioIntegraciones } from '@/modules/integraciones/infrastructure/repositorio'
import { enviarWebhookHttp } from '@/modules/integraciones/infrastructure/http'
import {
  generarCredenciales,
  generarSecretoWebhook,
  hashClave,
} from '@/modules/integraciones/infrastructure/seguridad'
import type { DepsIntegraciones } from '@/modules/integraciones/application/ports'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { crearConsultasAsistente } from '@/modules/asistente/infrastructure/consultas'
import { crearLimitadorMemoria } from '@/modules/asistente/infrastructure/limite-memoria'
import { crearProveedorDesdeEntorno } from '@/modules/asistente/infrastructure/openai-compatible'
import type { DepsAsistente } from '@/modules/asistente/application/ports'
import { env } from '@/config/env'

/**
 * Raíz de composición: une los puertos de la aplicación con los adaptadores
 * concretos. Las páginas y Server Actions solo ven los casos de uso.
 */
export const depsCalendario = { repo: repositorioCalendario }

/**
 * Capacidad laboral por fecha, sin descontar ausencias: es la base con la que
 * se mide cuánto saldo consume una vacación de jornada completa.
 */
async function capacidadPorFecha(
  empleadoId: string,
  desde: FechaIso,
  hasta: FechaIso,
): Promise<Record<FechaIso, CapacidadDia>> {
  const mapa: Record<FechaIso, CapacidadDia> = {}
  let inicio = desde

  // Tope de seguridad: cinco años de semanas. Nunca se pide más desde la UI.
  for (let indice = 0; indice < 300 && inicio <= hasta; indice += 1) {
    const semana = semanaIsoDe(inicio)
    const resuelta = await obtenerSemanaCalendario(depsCalendario, empleadoId, semana)
    for (const dia of resuelta.dias) {
      mapa[dia.fecha] = { laborable: dia.laborable, horasTeoricasMin: dia.horasTeoricasMin }
    }
    inicio = sumarDias(semana.weekEnd, 1)
  }

  return mapa
}

export const depsAusencias: DepsAusencias = {
  repo: repositorioAusencias,
  capacidad: capacidadPorFecha,
}

export const depsComputo: DepsComputo = {
  repo: repositorioComputo,
  diasFestivos: async (empleadoId, weekStart) => {
    const semana = await obtenerSemanaCalendario(depsCalendario, empleadoId, semanaIsoDe(weekStart))
    return semana.dias.filter((dia) => dia.motivo?.tipo === 'FESTIVO').map((dia) => dia.fecha)
  },
}

export const depsCoste: DepsCoste = {
  repo: repositorioCoste,
}

export const depsInformes: DepsInformes = {
  repo: repositorioInformes,
  consultas: consultasInformes,
  encolar: { encolar: encolarInforme },
}

export const depsCierre: DepsCierre = {
  repo: repositorioCierre,
  recalcular: async (parteId) => {
    await computarParte(depsComputo, parteId)
    await costearParte(depsCoste, parteId)
  },
}

export const depsEmail: DepsEmail = {
  repo: repositorioEmail,
  enviar: enviarEmail,
  encolar: encolarEmail,
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  proveedorConfigurado: smtpConfigurado(),
}

export const depsIntegraciones: DepsIntegraciones = {
  repo: repositorioIntegraciones,
  enviarWebhook: enviarWebhookHttp,
  ahora: () => new Date(),
  generarCredenciales,
  hashClave,
  generarSecretoWebhook,
}

export const depsPartes: DepsPartes = {
  repo: repositorioPartes,
  proyectosPermitidos,
  proyectosDeParte,
  calendario: {
    semana: async (empleadoId, semana) => {
      const resuelta = await obtenerSemanaCalendario(depsCalendario, empleadoId, semana)
      const ausencias = await ausenciasDeSemana(
        depsAusencias,
        empleadoId,
        semana.weekStart,
        semana.weekEnd,
      )

      const dias = aplicarAusenciasADias(
        resuelta.dias.map((dia) => ({
          fecha: dia.fecha,
          laborable: dia.laborable,
          motivo: textoMotivo(dia.motivo) || null,
          horasTeoricasMin: dia.horasTeoricasMin,
        })),
        ausencias,
      )

      return {
        calendarioId: resuelta.calendarioId,
        calendarioVersion: resuelta.calendarioVersion,
        capacidadMin: capacidadDeDias(dias),
        porDefecto: resuelta.porDefecto,
        dias: dias.map((dia) => ({
          fecha: dia.fecha,
          diaSemana: resuelta.dias.find((base) => base.fecha === dia.fecha)?.diaSemana ?? 0,
          laborable: dia.laborable,
          motivo: dia.motivo,
          esFestivo: resuelta.dias.find((base) => base.fecha === dia.fecha)?.motivo?.tipo === 'FESTIVO',
          horasTeoricasMin: dia.horasTeoricasMin,
          ausencia: dia.ausencia,
        })),
      }
    },
  },
  alAprobar: async (parteId) => {
    await computarParte(depsComputo, parteId)
    await costearParte(depsCoste, parteId)
  },
  alReabrir: async (parteId) => {
    await repositorioComputo.borrarResultados(parteId)
    await repositorioCoste.borrarCostesDeParte(parteId)
  },
  cierre: {
    fechasBloqueadas: (empresaId, empleadoId, desde, hasta) =>
      fechasBloqueadas(depsCierre, empresaId, empleadoId, desde, hasta),
  },
}

export const depsAvisos: DepsAvisos = {
  repo: repositorioNotificaciones,
  consultas: consultasAvisos,
}

/**
 * Asistente de IA: solo lectura y sin escrituras de negocio. Comparte la
 * autorización y las consultas de `partes` y `reporting` para no crear una
 * segunda fuente de verdad.
 */
export const depsAsistente: DepsAsistente = {
  proveedor: crearProveedorDesdeEntorno(),
  consultas: crearConsultasAsistente({ depsPartes, proyectosPermitidos }),
  auditoria: registrarAuditoria,
  limite: crearLimitadorMemoria({ porUsuarioPorMinuto: 20, porUsuarioPorSegundo: 1 }),
  ahora: () => new Date(),
  pseudonimizar: () => env().IA_PSEUDONIMIZAR,
}

export { repositorioNotificaciones }
