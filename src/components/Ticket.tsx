import type { ReactNode } from 'react'
import { Barcode, Clock, Scissors, Tag, User } from 'lucide-react'
import { crcText, hhmm, monthYear, monthYearTitle, parseISO, weekdayName } from '../lib/format'
import type { BookingStatus } from '../lib/types'
import StatusBadge from './StatusBadge'

export interface TicketData {
  code: string
  client_name: string
  service_name: string
  barber_name: string
  date: string
  start_time: string
  duration_min: number
  price: number
  status: BookingStatus
  phone?: string
  email?: string | null
}

interface Props {
  booking: TicketData
  variant?: 'shop' | 'admin'
  showIcons?: boolean
  extra?: ReactNode
}

export default function Ticket({ booking, variant = 'shop', showIcons = false, extra }: Props) {
  const cancelled = booking.status === 'cancelada' || booking.status === 'no_asistio'
  const day = parseISO(booking.date).getDate()
  const rows: { icon: ReactNode; label: string; value: ReactNode }[] = [
    { icon: <User size={20} />, label: 'Cliente', value: booking.client_name },
    { icon: <Scissors size={20} />, label: 'Servicio', value: booking.service_name },
  ]
  if (variant === 'admin') rows.push({ icon: <Clock size={20} />, label: 'Duración', value: `${booking.duration_min} min` })
  rows.push({ icon: <Barcode size={20} />, label: 'Barbero', value: booking.barber_name })
  if (variant === 'admin')
    rows.push({ icon: <Barcode size={20} />, label: 'Código de check-in', value: <span className="mono">{booking.code}</span> })
  rows.push({ icon: <Tag size={20} />, label: 'Precio', value: crcText(booking.price) })
  if (variant === 'admin' && booking.phone) rows.push({ icon: null, label: 'WhatsApp', value: booking.phone })
  if (variant === 'admin' && booking.email) rows.push({ icon: null, label: 'Correo', value: booking.email })
  rows.push({ icon: <Clock size={20} />, label: 'Estado', value: <StatusBadge status={booking.status} /> })

  return (
    <div className={`ticket ticket-${variant} ${cancelled ? 'is-cancelled' : ''}`}>
      <div className="ticket-stripe" />
      <div className="ticket-head">
        <div className="ticket-day">{variant === 'admin' ? String(day).padStart(2, '0') : day}</div>
        <div className="ticket-date">
          <strong>{weekdayName(booking.date)}</strong>
          <span>{variant === 'admin' ? monthYearTitle(booking.date) : monthYear(booking.date)}</span>
        </div>
        <div className="ticket-time">
          <small>{variant === 'admin' ? 'HORA' : 'Hora'}</small>
          <span>{hhmm(booking.start_time)}</span>
        </div>
      </div>
      <div className="ticket-body">
        {rows.map((r) => (
          <div className="ticket-row" key={r.label}>
            {showIcons && <span className="ticket-row-icon">{r.icon}</span>}
            <span className="ticket-label">{r.label}</span>
            <span className="ticket-value">{r.value}</span>
          </div>
        ))}
        {extra}
      </div>
    </div>
  )
}
