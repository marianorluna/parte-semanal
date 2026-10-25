import {
  claveEmail,
  debeEnviarEmail,
  debeMostrarInApp,
  emailValido,
  interpretarFallo,
} from './email'
import { construirEmail, escaparHtml, urlAbsoluta, VERSION_PLANTILLAS } from './plantillas'

describe('emailValido', () => {
  it('acepta direcciones normales', () => {
    expect(emailValido('dsierra@levitec.es')).toBe(true)
    expect(emailValido('  nombre.apellido+parte@sub.dominio.com  ')).toBe(true)
  })

  it('rechaza direcciones incompletas', () => {
    expect(emailValido('sin-arroba.es')).toBe(false)
    expect(emailValido('a@b')).toBe(false)
    expect(emailValido('a b@c.es')).toBe(false)
    expect(emailValido('')).toBe(false)
  })
})

describe('claveEmail', () => {
  it('incluye tipo y clave del aviso para no mezclar eventos', () => {
    expect(claveEmail('RECORDATORIO_PARTE', 'recordatorio:2026-W44')).toBe(
      'recordatorio_parte:recordatorio:2026-W44',
    )
  })

  it('es estable entre llamadas', () => {
    const a = claveEmail('RIESGO_PROYECTO', 'riesgo:p1:2026-10-24')
    const b = claveEmail('RIESGO_PROYECTO', 'riesgo:p1:2026-10-24')
    expect(a).toBe(b)
  })
})

describe('preferencias', () => {
  it('sin fila se envía y se muestra', () => {
    expect(debeEnviarEmail(undefined)).toBe(true)
    expect(debeMostrarInApp(undefined)).toBe(true)
  })

  it('respeta el opt-out explícito', () => {
    expect(debeEnviarEmail({ email: false, inApp: true })).toBe(false)
    expect(debeMostrarInApp({ email: true, inApp: false })).toBe(false)
  })
})

describe('interpretarFallo', () => {
  it('distingue proveedor ausente de error reintentable', () => {
    expect(interpretarFallo('SMTP_URL no configurado')).toEqual({ tipo: 'SIN_PROVEEDOR' })
    expect(interpretarFallo('ETIMEDOUT')).toEqual({ tipo: 'FALLIDO', mensaje: 'ETIMEDOUT' })
  })
})

describe('plantillas', () => {
  it('escaparHtml neutraliza etiquetas y comillas', () => {
    expect(escaparHtml('<script>"x" & \'y\'</script>')).toBe(
      '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
    )
  })

  it('construye URL absoluta sin duplicar barras', () => {
    expect(urlAbsoluta('https://horas.levitec.es/', '/mi-semana?y=2026')).toBe(
      'https://horas.levitec.es/mi-semana?y=2026',
    )
    expect(urlAbsoluta('https://horas.levitec.es', null)).toBeNull()
    expect(urlAbsoluta('https://horas.levitec.es', 'https://otra.es/x')).toBe('https://otra.es/x')
  })

  it('genera asunto, texto y HTML con el enlace', () => {
    const mensaje = construirEmail({
      tipo: 'RECORDATORIO_PARTE',
      titulo: 'Te faltan horas por enviar',
      cuerpo: 'Semana 44: revisa tu parte.',
      url: '/mi-semana?y=2026&w=44',
      appUrl: 'https://horas.levitec.es',
      nombreDestinatario: 'Dani',
    })

    expect(mensaje.asunto).toBe('[LeviParte] Te faltan horas por enviar')
    expect(mensaje.texto).toContain('Hola Dani:')
    expect(mensaje.texto).toContain('https://horas.levitec.es/mi-semana?y=2026&w=44')
    expect(mensaje.html).toContain('href="https://horas.levitec.es/mi-semana?y=2026&amp;w=44"')
  })

  it('mantiene una versión explícita de plantilla', () => {
    expect(VERSION_PLANTILLAS).toBeGreaterThanOrEqual(1)
  })
})
