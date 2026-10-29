import { ChevronRight } from 'lucide-react'
import { crc, hhmm, shortDate } from '../lib/format'
import type { Booking } from '../lib/types'
import StatusBadge from './StatusBadge'

export default function BookingCard({ booking, onClick, showDate = true }: { booking: Booking; onClick: () => void; showDate?: boolean }) {
  return (
    <button className={`booking-card status-${booking.status}`} onClick={onClick}>
      <div className="booking-time">
        <strong>{hhmm(booking.start_time)}</strong>
        {showDate && <small>{shortDate(booking.date)}</small>}
      </div>
      <div className="booking-info">
        <strong>{booking.client_name}</strong>
        <span>
          {booking.service_name} · {booking.barber_name}
        </span>
        <span className="booking-meta">
          <StatusBadge status={booking.status} /> <span className="mono">{booking.code}</span> · {crc(booking.price)}
        </span>
      </div>
      <ChevronRight size={22} className="chev" />
    </button>
  )
}
