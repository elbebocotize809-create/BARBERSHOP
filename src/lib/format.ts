import { COUNTRY_CODE, SHOP_TZ } from './brand'
import type { BookingStatus } from './types'

/** Fecha actual de la barbería como YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TZ }).format(new Date())
}

/** Hora actual de la barbería como HH:MM. */
export function nowHHMM(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: SHOP_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
}

export function parseISO(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(date: string, days: number): string {
  const d = parseISO(date)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const WEEKDAYS_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
export const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function weekdayName(date: string): string {
  return WEEKDAYS[parseISO(date).getDay()]
}

export function monthYear(date: string): string {
  const d = parseISO(date)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** "Diciembre De 2026" */
export function monthYearTitle(date: string): string {
  const d = parseISO(date)
  return `${cap(MONTHS[d.getMonth()])} De ${d.getFullYear()}`
}

/** "Miércoles 2 de diciembre" */
export function longDate(date: string): string {
  const d = parseISO(date)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

/** "28/10/2026" */
export function shortDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : ''
}

export function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** ₡22.000 */
export function crc(amount: number): string {
  return (
    '₡' +
    Math.round(amount)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  )
}

/** CRC 22.000 */
export function crcText(amount: number): string {
  return (
    'CRC ' +
    Math.round(amount)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  )
}

export function greeting(): string {
  const h = Number(nowHHMM().slice(0, 2))
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function waLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '')
  const full = digits.length === 8 ? COUNTRY_CODE + digits : digits
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  nueva: 'Nueva',
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
}

/** Convierte el texto de un QR (URL o código) en un código de reserva. */
export function extractCode(raw: string): string {
  const text = raw.trim()
  const match = text.match(/\/reserva\/([A-Za-z0-9]+)/)
  return (match ? match[1] : text).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function bookingUrl(code: string): string {
  return `${window.location.origin}/reserva/${code}`
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return 'Ocurrió un error. Intenta de nuevo.'
}
