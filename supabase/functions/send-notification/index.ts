// Envía la confirmación (o la cancelación) de una cita por correo (Resend) y WhatsApp (Meta Cloud API).
//
// POST { code: "YDR2LV", type: "confirmation" | "cancellation" }
//
// Cada tipo se envía una sola vez por reserva: la columna confirmation_sent_at /
// cancellation_sent_at se marca antes de enviar, así que llamar la función de nuevo no reenvía nada.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import QRCode from 'npm:qrcode@1.5.4'

const env = (k: string) => Deno.env.get(k) ?? ''

const SITE_URL = env('PUBLIC_SITE_URL').replace(/\/$/, '')
const SHOP_NAME = env('SHOP_NAME') || 'Isaac Barbershop'
const COUNTRY_CODE = env('WHATSAPP_COUNTRY_CODE') || '506'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Booking {
  id: string
  code: string
  client_name: string
  phone: string
  email: string | null
  service_name: string
  barber_name: string
  date: string
  start_time: string
  duration_min: number
  price: number
  status: string
  confirmation_sent_at: string | null
  cancellation_sent_at: string | null
}

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function dateParts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  return { day: d, weekday: WEEKDAYS[date.getUTCDay()], month: MONTHS[m - 1], year: y }
}

const crc = (n: number) => 'CRC ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function emailHtml(b: Booking, type: 'confirmation' | 'cancellation', link: string) {
  const p = dateParts(b.date)
  const time = b.start_time.slice(0, 5)
  const cancelled = type === 'cancellation'
  const statusLabel = cancelled ? 'Cancelada' : b.status === 'confirmada' ? 'Confirmada' : 'Reservada'
  const statusStyle = cancelled ? 'background:#ececee;color:#6b6f78' : 'background:#d7f3df;color:#15803d'
  const strike = cancelled ? 'text-decoration:line-through;color:#9a9ea8;' : ''
  const row = (label: string, value: string, last = false) => `
    <tr>
      <td style="padding:16px 0;color:#7b818c;font-size:16px;${last ? '' : 'border-bottom:1px solid #dfe3ea;'}">${label}</td>
      <td style="padding:16px 0;text-align:right;font-weight:700;font-size:16px;color:#2b2f36;${last ? '' : 'border-bottom:1px solid #dfe3ea;'}">${value}</td>
    </tr>`
  const stripe = Array.from({ length: 24 }, (_, i) => `<td style="height:10px;background:${['#d64545', '#2b2f36', '#4a86e8', '#2b2f36'][i % 4]}"></td>`).join('')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f7;font-family:Helvetica,Arial,sans-serif;color:#2b2f36">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f7;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="text-align:center;padding-bottom:8px;font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:1px">${esc(SHOP_NAME.toUpperCase())}</td></tr>
        <tr><td style="font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:34px;letter-spacing:1px;text-transform:uppercase;padding:18px 0 6px">
          ${cancelled ? 'Tu cita fue cancelada' : 'Confirmación de tu cita'}
        </td></tr>
        <tr><td style="font-size:17px;line-height:1.6;padding-bottom:20px">
          Hola <strong>${esc(b.client_name)}</strong>,<br>
          ${cancelled ? 'Tu cita fue cancelada. Si fue un error, puedes agendar una nueva cuando quieras.' : 'Tu cita fue registrada correctamente.'}
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:22px;overflow:hidden;background:#eef1f7">
            <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stripe}</tr></table></td></tr>
            <tr><td style="padding:24px 28px;border-bottom:2px dashed #c9ced8;background:#e4e8f0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="font-size:64px;font-weight:800;line-height:1;width:1%;padding-right:14px;${strike}">${p.day}</td>
                <td style="vertical-align:bottom"><div style="font-size:20px;font-weight:700">${p.weekday}</div><div style="font-size:17px;color:#7b818c">${p.month} ${p.year}</div></td>
                <td style="text-align:right;vertical-align:bottom"><div style="font-size:14px;color:#7b818c">Hora</div>
                  <div style="font-size:40px;font-weight:800;color:${cancelled ? '#9a9ea8' : '#118a3a'};${strike}">${time}</div></td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:4px 28px 10px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${row('Cliente', esc(b.client_name))}
                ${row('Servicio', esc(b.service_name))}
                ${row('Barbero', esc(b.barber_name))}
                ${row('Precio', crc(b.price))}
                ${row('Estado', `<span style="display:inline-block;padding:6px 16px;border-radius:999px;font-size:14px;${statusStyle}">${statusLabel}</span>`, true)}
              </table>
            </td></tr>
          </table>
        </td></tr>
        ${
          cancelled
            ? ''
            : `<tr><td style="text-align:center;padding:26px 0 6px;font-weight:700;font-size:17px">Presenta este código al llegar</td></tr>
        <tr><td align="center"><img src="cid:qr" width="200" height="200" alt="Código QR" style="display:block;background:#fff;padding:12px;border-radius:14px"></td></tr>
        <tr><td style="text-align:center;padding:10px 0 0;letter-spacing:6px;font-weight:700;font-size:18px">${b.code}</td></tr>`
        }
        <tr><td align="center" style="padding:26px 0">
          <a href="${link}" style="display:inline-block;background:#16171b;color:#fff;text-decoration:none;padding:16px 30px;border-radius:999px;font-weight:700;letter-spacing:2px">
            ${cancelled ? 'AGENDAR OTRA CITA' : 'VER O CANCELAR MI CITA'}
          </a>
        </td></tr>
        <tr><td style="text-align:center;color:#9a9ea8;font-size:13px">Código de reserva: ${b.code}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function sendEmail(b: Booking, type: 'confirmation' | 'cancellation', link: string) {
  const key = env('RESEND_API_KEY')
  const from = env('EMAIL_FROM')
  if (!b.email) return 'sin correo'
  if (!key || !from) return 'no configurado'

  const attachments = []
  if (type === 'confirmation') {
    const dataUrl: string = await QRCode.toDataURL(link, { width: 400, margin: 1 })
    attachments.push({ filename: 'qr.png', content: dataUrl.split(',')[1], content_id: 'qr' })
  }
  const p = dateParts(b.date)
  const subject =
    type === 'confirmation'
      ? `Tu cita: ${p.weekday} ${p.day} de ${p.month}, ${b.start_time.slice(0, 5)} · ${SHOP_NAME}`
      : `Cita cancelada: ${p.weekday} ${p.day} de ${p.month} · ${SHOP_NAME}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [b.email], subject, html: emailHtml(b, type, link), attachments }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  return 'enviado'
}

async function sendWhatsApp(b: Booking, type: 'confirmation' | 'cancellation', link: string) {
  const token = env('WHATSAPP_TOKEN')
  const phoneId = env('WHATSAPP_PHONE_NUMBER_ID')
  const template = type === 'confirmation' ? env('WHATSAPP_TEMPLATE_CONFIRMATION') : env('WHATSAPP_TEMPLATE_CANCELLATION')
  if (!token || !phoneId || !template) return 'no configurado'

  const digits = b.phone.replace(/\D/g, '')
  const to = digits.length === 8 ? COUNTRY_CODE + digits : digits
  const p = dateParts(b.date)
  const params =
    type === 'confirmation'
      ? [b.client_name, b.service_name, `${p.weekday} ${p.day} de ${p.month}`, b.start_time.slice(0, 5), b.barber_name, b.code, link]
      : [b.client_name, `${p.weekday} ${p.day} de ${p.month}`, b.start_time.slice(0, 5), link]

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: env('WHATSAPP_TEMPLATE_LANG') || 'es' },
        components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
      },
    }),
  })
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`)
  return 'enviado'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let code = ''
  let type: 'confirmation' | 'cancellation' = 'confirmation'
  try {
    const body = await req.json()
    code = String(body.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (body.type === 'cancellation') type = 'cancellation'
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (code.length < 4) return json({ error: 'Código inválido' }, 400)

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const column = type === 'confirmation' ? 'confirmation_sent_at' : 'cancellation_sent_at'

  // Se marca antes de enviar para que dos llamadas simultáneas no envíen dos veces.
  let claim = db.from('bookings').update({ [column]: new Date().toISOString() }).eq('code', code).is(column, null)
  claim = type === 'cancellation' ? claim.eq('status', 'cancelada') : claim.neq('status', 'cancelada')
  const { data, error } = await claim.select().maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ skipped: true })

  const b = data as Booking
  const link = type === 'confirmation' ? `${SITE_URL}/reserva/${b.code}` : `${SITE_URL}/`
  const qrLink = `${SITE_URL}/reserva/${b.code}`

  const [email, whatsapp] = await Promise.allSettled([
    sendEmail(b, type, type === 'confirmation' ? qrLink : link),
    sendWhatsApp(b, type, type === 'confirmation' ? qrLink : link),
  ])
  const result = {
    email: email.status === 'fulfilled' ? email.value : String(email.reason),
    whatsapp: whatsapp.status === 'fulfilled' ? whatsapp.value : String(whatsapp.reason),
  }
  if (email.status === 'rejected' || whatsapp.status === 'rejected') console.error(code, type, result)
  // Si ningún canal funcionó, se libera la marca para poder reintentar.
  const sent = Object.values(result).includes('enviado')
  if (!sent && (email.status === 'rejected' || whatsapp.status === 'rejected')) {
    await db.from('bookings').update({ [column]: null }).eq('id', b.id)
  }
  return json(result)
})
