import { ArrowRight, CalendarCheck, CalendarDays, CircleCheck, Clock, Contact, Cpu, Hourglass } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BookingCard from '../../components/BookingCard'
import BookingSheet from '../../components/BookingSheet'
import { fetchBookings } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { errorMessage, hhmm, nowHHMM, shortDate, todayISO } from '../../lib/format'
import type { Booking } from '../../lib/types'
import { useAdmin } from './AdminContext'

export default function Dashboard() {
  const { profile, session } = useAuth()
  const { refreshKey, live } = useAdmin()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Booking | null>(null)
  const today = todayISO()

  useEffect(() => {
    fetchBookings({ from: today, statuses: ['nueva', 'confirmada', 'en_curso', 'completada'] })
      .then(setBookings)
      .catch((err) => setError(errorMessage(err)))
  }, [today, refreshKey])

  const now = nowHHMM()
  const list = bookings ?? []
  const todays = list.filter((b) => b.date === today)
  const upcoming = list.filter((b) => (b.status === 'nueva' || b.status === 'confirmada') && (b.date > today || hhmm(b.start_time) >= now))
  const pending = upcoming.filter((b) => b.status === 'nueva')
  const confirmed = upcoming.filter((b) => b.status === 'confirmada')
  const inProgress = list.filter((b) => b.status === 'en_curso')

  const stats = [
    { label: 'Reservas hoy', value: todays.length, icon: CalendarCheck, tone: 'blue', to: '/admin/agenda' },
    { label: 'Próximas', value: upcoming.length, icon: Clock, tone: 'sky', to: '/admin/reservas' },
    { label: 'Pendientes', value: pending.length, icon: Hourglass, tone: 'amber', to: '/admin/reservas?f=nueva' },
    { label: 'Confirmadas', value: confirmed.length, icon: CircleCheck, tone: 'green', to: '/admin/reservas?f=confirmada' },
  ]

  const name = profile?.full_name?.split(' ')[0] || 'Administrador'

  return (
    <div className="page">
      <section className="hero">
        <h2>Hola, {name}</h2>
        <p>Resumen general de la barbería y sus reservas.</p>
        <div className="hero-pills">
          <span className="pill">
            <CalendarDays size={22} /> {shortDate(today)}
          </span>
          <span className="pill">
            <span className={`live-dot ${live ? 'on' : ''}`} /> {live ? 'Reservas en tiempo real' : 'Conectando…'}
          </span>
        </div>
      </section>

      <section className="card profile-card">
        <span className="avatar-lg">
          <Cpu size={52} />
        </span>
        <div>
          <h3>{profile?.full_name || 'Administrador del Sistema'}</h3>
          <div className="chips">
            <span className="chip chip-blue">
              <Contact size={18} /> ADMIN
            </span>
            <span className="chip chip-green">
              <span className="live-dot on" /> EN LÍNEA
            </span>
          </div>
          <p className="muted">{session?.user.email}</p>
        </div>
      </section>

      <div className="section-head">
        <h3>RESERVAS</h3>
        <Link to="/admin/reservas">
          VER RESERVAS <ArrowRight size={20} />
        </Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats">
        {stats.map((s) => (
          <button key={s.label} className={`stat stat-${s.tone}`} onClick={() => navigate(s.to)}>
            <span className="stat-label">{s.label}</span>
            <span className="stat-icon">
              <s.icon size={30} />
            </span>
            <strong className="stat-value">{bookings ? s.value : '–'}</strong>
            <svg className="stat-wave" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 50 C60 60 110 55 200 10 V60 H0Z" />
            </svg>
          </button>
        ))}
      </div>

      {inProgress.length > 0 && (
        <>
          <div className="section-head">
            <h3>EN CURSO</h3>
          </div>
          <div className="list">
            {inProgress.map((b) => (
              <BookingCard key={b.id} booking={b} onClick={() => setOpen(b)} />
            ))}
          </div>
        </>
      )}

      <div className="section-head">
        <h3>PRÓXIMAS CITAS</h3>
        <Link to="/admin/agenda">
          AGENDA <ArrowRight size={20} />
        </Link>
      </div>
      <div className="list">
        {bookings && upcoming.length === 0 && <p className="empty">No hay citas próximas.</p>}
        {upcoming.slice(0, 8).map((b) => (
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
