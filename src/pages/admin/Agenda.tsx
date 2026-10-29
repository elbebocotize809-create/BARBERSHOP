import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import BookingCard from '../../components/BookingCard'
import BookingSheet from '../../components/BookingSheet'
import { fetchBarbers, fetchBookings } from '../../lib/api'
import { addDays, cap, crc, errorMessage, longDate, todayISO } from '../../lib/format'
import type { Barber, Booking } from '../../lib/types'
import { useAdmin } from './AdminContext'

export default function Agenda() {
  const { refreshKey } = useAdmin()
  const [date, setDate] = useState(todayISO())
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [showCancelled, setShowCancelled] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Booking | null>(null)

  useEffect(() => {
    fetchBarbers(true)
      .then(setBarbers)
      .catch(() => {})
  }, [])

  useEffect(() => {
    setBookings(null)
    fetchBookings({ from: date, to: date })
      .then(setBookings)
      .catch((err) => setError(errorMessage(err)))
  }, [date, refreshKey])

  const visible = (bookings ?? []).filter((b) => showCancelled || (b.status !== 'cancelada' && b.status !== 'no_asistio'))
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: Booking[] }>()
    for (const b of visible) {
      const key = b.barber_id ?? b.barber_name
      if (!map.has(key)) map.set(key, { name: b.barber_name, items: [] })
      map.get(key)!.items.push(b)
    }
    const order = (k: string) => barbers.findIndex((b) => b.id === k)
    return [...map.entries()].sort((a, b) => order(a[0]) - order(b[0]))
  }, [visible, barbers])

  const total = visible.filter((b) => b.status !== 'cancelada' && b.status !== 'no_asistio').reduce((s, b) => s + b.price, 0)

  return (
    <div className="page">
      <div className="day-nav card">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior">
          <ChevronLeft size={26} />
        </button>
        <div>
          <strong>{cap(longDate(date))}</strong>
          <input type="date" className="date-input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente">
          <ChevronRight size={26} />
        </button>
      </div>
      <div className="toolbar">
        <button className="btn btn-soft sm" onClick={() => setDate(todayISO())}>
          Hoy
        </button>
        <label className="check">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Mostrar canceladas
        </label>
        <span className="muted">
          {visible.length} citas · {crc(total)}
        </span>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {bookings && groups.length === 0 && <p className="empty">No hay citas este día.</p>}
      {groups.map(([key, g]) => (
        <section key={key}>
          <div className="section-head">
            <h3>{g.name.toUpperCase()}</h3>
            <span className="muted">{g.items.length} citas</span>
          </div>
          <div className="list">
            {g.items.map((b) => (
              <BookingCard key={b.id} booking={b} showDate={false} onClick={() => setOpen(b)} />
            ))}
          </div>
        </section>
      ))}
      {open && (
        <BookingSheet
          booking={open}
          onClose={() => setOpen(null)}
          onChanged={(u) => setBookings((prev) => prev?.map((x) => (x.id === u.id ? u : x)) ?? null)}
        />
      )}
    </div>
  )
}
