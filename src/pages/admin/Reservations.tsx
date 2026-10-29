import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BookingCard from '../../components/BookingCard'
import BookingSheet from '../../components/BookingSheet'
import { fetchBookings, type BookingQuery } from '../../lib/api'
import { addDays, errorMessage, todayISO } from '../../lib/format'
import type { Booking } from '../../lib/types'
import { useAdmin } from './AdminContext'

const FILTERS: { key: string; label: string; query: (today: string) => BookingQuery }[] = [
  { key: 'proximas', label: 'Próximas', query: (t) => ({ from: t, statuses: ['nueva', 'confirmada', 'en_curso'] }) },
  { key: 'hoy', label: 'Hoy', query: (t) => ({ from: t, to: t }) },
  { key: 'nueva', label: 'Pendientes', query: (t) => ({ from: t, statuses: ['nueva'] }) },
  { key: 'confirmada', label: 'Confirmadas', query: (t) => ({ from: t, statuses: ['confirmada'] }) },
  { key: 'cancelada', label: 'Canceladas', query: (t) => ({ from: addDays(t, -30), statuses: ['cancelada'] }) },
  { key: 'todas', label: 'Todas', query: (t) => ({ from: addDays(t, -30) }) },
]

/** Lista de reservas. Con `history` muestra las citas pasadas, de la más reciente a la más antigua. */
export default function Reservations({ history = false }: { history?: boolean }) {
  const { refreshKey } = useAdmin()
  const [params, setParams] = useSearchParams()
  const filter = params.get('f') ?? 'proximas'
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Booking | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setTerm(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const today = todayISO()
    const q: BookingQuery = history
      ? { to: addDays(today, -1), ascending: false, limit: 300 }
      : (FILTERS.find((f) => f.key === filter) ?? FILTERS[0]).query(today)
    fetchBookings({ ...q, search: term })
      .then(setBookings)
      .catch((err) => setError(errorMessage(err)))
  }, [filter, term, history, refreshKey])

  return (
    <div className="page">
      <div className="search">
        <Search size={22} />
        <input placeholder="Buscar por nombre, teléfono o código" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {!history && (
        <div className="tabs">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setParams({ f: f.key })}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {bookings && <p className="muted small">{bookings.length} reservas</p>}
      <div className="list">
        {bookings?.length === 0 && <p className="empty">No hay reservas para mostrar.</p>}
        {bookings?.map((b) => (
          <BookingCard key={b.id} booking={b} onClick={() => setOpen(b)} />
        ))}
      </div>
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
