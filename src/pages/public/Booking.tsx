import { CalendarDays, ChevronLeft, ChevronRight, CircleHelp, Clock, Send, UserRound, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BarberPole from '../../components/BarberPole'
import Logo from '../../components/Logo'
import QRImage from '../../components/QRImage'
import ServiceIcon from '../../components/ServiceIcon'
import Spinner from '../../components/Spinner'
import StatusBadge from '../../components/StatusBadge'
import { createBooking, fetchAvailableDates, fetchBarbers, fetchServices, fetchSettings, fetchSlots, sendNotification } from '../../lib/api'
import {
  bookingUrl,
  cap,
  crc,
  crcText,
  errorMessage,
  hhmm,
  longDate,
  MONTHS,
  toISO,
  todayISO,
  WEEKDAYS_SHORT,
  addDays,
  parseISO,
} from '../../lib/format'
import type { Barber, PublicBooking, Service } from '../../lib/types'

const STEPS = ['Servicio', 'Fecha', 'Barbero', 'Hora', 'Tus datos']
const HELP = [
  'Toca un servicio para seleccionarlo. El precio y la duración son aproximados.',
  'Los días en gris no tienen espacios disponibles para el servicio elegido.',
  'Elige con quién quieres tu cita, o deja que asignemos al primer barbero libre.',
  'Estas son las horas libres para ese día. Si no ves la que buscas, prueba otra fecha.',
  'Usaremos tu WhatsApp para confirmar tu cita. El correo es opcional y sirve para recibir el comprobante.',
]
const SAVED_KEY = 'barbershop.customer'

interface Slot {
  barber_id: string
  start_time: string
}

function loadSaved(): { name: string; phone: string; email: string } {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (raw) return { name: '', phone: '', email: '', ...JSON.parse(raw) }
  } catch {
    /* almacenamiento no disponible */
  }
  return { name: '', phone: '', email: '' }
}

function saveCustomer(data: { name: string; phone: string; email: string }) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(data))
  } catch {
    /* almacenamiento no disponible */
  }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Booking({ adminMode = false }: { adminMode?: boolean }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [help, setHelp] = useState(false)
  const [services, setServices] = useState<Service[] | null>(null)
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [windowDays, setWindowDays] = useState(60)
  const [loadError, setLoadError] = useState('')

  const [service, setService] = useState<Service | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [barberId, setBarberId] = useState<string | null | undefined>(undefined)
  const [time, setTime] = useState<string | null>(null)
  const [form, setForm] = useState(() => ({ ...(adminMode ? { name: '', phone: '', email: '' } : loadSaved()), notes: '' }))

  const [month, setMonth] = useState(() => {
    const d = parseISO(todayISO())
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [availableDates, setAvailableDates] = useState<Record<string, Set<string>>>({})
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PublicBooking | null>(null)

  const today = todayISO()
  const lastDay = addDays(today, windowDays)

  useEffect(() => {
    Promise.all([fetchServices(), fetchBarbers(), fetchSettings()])
      .then(([s, b, cfg]) => {
        setServices(s)
        setBarbers(b)
        setWindowDays(cfg.booking_window_days)
      })
      .catch((err) => setLoadError(errorMessage(err)))
  }, [])

  // Días disponibles del mes visible
  const mk = monthKey(month)
  useEffect(() => {
    if (step !== 1 || !service || availableDates[mk]) return
    const first = toISO(month)
    const last = toISO(new Date(month.getFullYear(), month.getMonth() + 1, 0))
    const from = first < today ? today : first
    const to = last > lastDay ? lastDay : last
    if (from > to) {
      setAvailableDates((prev) => ({ ...prev, [mk]: new Set() }))
      return
    }
    fetchAvailableDates(service.id, from, to)
      .then((dates) => setAvailableDates((prev) => ({ ...prev, [mk]: new Set(dates.map((d) => d.slice(0, 10))) })))
      .catch((err) => setError(errorMessage(err)))
  }, [step, service, mk, month, availableDates, today, lastDay])

  // Horarios del día elegido (todos los barberos)
  useEffect(() => {
    if (!service || !date || step < 2) return
    if (slots) return
    fetchSlots(service.id, date)
      .then(setSlots)
      .catch((err) => setError(errorMessage(err)))
  }, [service, date, step, slots])

  const barbersForDay = useMemo(() => {
    if (!slots) return []
    const ids = new Set(slots.map((s) => s.barber_id))
    return barbers.filter((b) => ids.has(b.id))
  }, [slots, barbers])

  const times = useMemo(() => {
    if (!slots) return []
    const list = slots.filter((s) => !barberId || s.barber_id === barberId).map((s) => hhmm(s.start_time))
    return [...new Set(list)].sort()
  }, [slots, barberId])

  const barberName = barberId ? barbers.find((b) => b.id === barberId)?.name : 'Primer barbero disponible'

  function resetFrom(s: number) {
    if (s <= 0) setAvailableDates({})
    if (s <= 1) {
      setSlots(null)
      setBarberId(undefined)
    }
    if (s <= 3) setTime(null)
    setError('')
  }

  function canContinue() {
    if (step === 0) return !!service
    if (step === 1) return !!date
    if (step === 2) return barberId !== undefined
    if (step === 3) return !!time
    return form.name.trim().length >= 2 && form.phone.replace(/\D/g, '').length >= 8
  }

  async function next() {
    setError('')
    setHelp(false)
    if (step < 4) {
      setStep(step + 1)
      window.scrollTo({ top: 0 })
      return
    }
    if (!service || !date || !time || barberId === undefined) return
    setBusy(true)
    try {
      const booking = await createBooking({
        serviceId: service.id,
        barberId,
        date,
        time,
        name: form.name,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
      })
      if (!adminMode) saveCustomer({ name: form.name.trim(), phone: form.phone, email: form.email.trim() })
      setResult(booking)
      void sendNotification(booking.code, 'confirmation')
      window.scrollTo({ top: 0 })
    } catch (err) {
      const msg = errorMessage(err)
      setError(msg)
      if (msg.includes('horario')) {
        setSlots(null)
        setTime(null)
        setStep(3)
      }
    } finally {
      setBusy(false)
    }
  }

  function back() {
    setHelp(false)
    setError('')
    setStep(Math.max(0, step - 1))
  }

  function exit() {
    if (adminMode) {
      navigate('/admin')
      return
    }
    setStep(0)
    setService(null)
    setDate(null)
    resetFrom(0)
    setResult(null)
  }

  if (result) return <Success booking={result} adminMode={adminMode} onNew={exit} />

  return (
    <div className="pub">
      <header className="pub-header">
        <div className="pub-header-side">
          {step === 0 ? (
            <span className="pole">
              <BarberPole height={56} />
            </span>
          ) : (
            <button className="pub-link" onClick={back}>
              <ChevronLeft size={28} /> Atrás
            </button>
          )}
        </div>
        <Logo />
        <div className="pub-header-side right">
          <button className="pub-link" onClick={exit}>
            Salir
          </button>
        </div>
      </header>

      <main className="pub-main">
        <div className="progress">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <p className="step-label">
          PASO {step + 1} DE {STEPS.length} · {STEPS[step].toUpperCase()}
        </p>

        <div className="step-head">
          <span className="step-icon">
            {step === 0 && <ServiceIcon icon="scissors" />}
            {step === 1 && <CalendarDays size={24} />}
            {step === 2 && <Users size={24} />}
            {step === 3 && <Clock size={24} />}
            {step === 4 && <UserRound size={24} />}
          </span>
          <h1>{['Elige tu servicio', 'Elige la fecha', 'Elige tu barbero', 'Elige la hora', 'Tus datos'][step]}</h1>
          <button className={`help-btn ${help ? 'on' : ''}`} onClick={() => setHelp(!help)} aria-label="Ayuda">
            <CircleHelp size={20} />
          </button>
        </div>
        <p className="step-sub">
          {
            [
              'Selecciona uno de los servicios disponibles en la barbería.',
              'Selecciona un día que tenga horarios disponibles.',
              date ? `Barberos con espacio el ${longDate(date).toLowerCase()}.` : '',
              'Selecciona una hora libre.',
              'Revisa tu cita y completa tus datos para reservar.',
            ][step]
          }
        </p>
        {help && <div className="help-box">{HELP[step]}</div>}
        {(error || loadError) && <div className="alert alert-error">{error || loadError}</div>}

        {step === 0 &&
          (services === null ? (
            !loadError && <Spinner label="Cargando servicios…" />
          ) : services.length === 0 ? (
            <p className="empty">Todavía no hay servicios disponibles.</p>
          ) : (
            <div className="option-list">
              {services.map((s) => (
                <button
                  key={s.id}
                  className={`option ${service?.id === s.id ? 'selected' : ''}`}
                  onClick={() => {
                    if (service?.id !== s.id) {
                      resetFrom(0)
                      setDate(null)
                    }
                    setService(s)
                  }}
                >
                  <span className="option-icon">
                    <ServiceIcon icon={s.icon} size={26} />
                  </span>
                  <span className="option-text">
                    <strong>{s.name}</strong>
                    <small>{s.category}</small>
                  </span>
                  <span className="option-meta">
                    <strong>{crc(s.price)}</strong>
                    <small>{s.duration_min} MIN</small>
                  </span>
                  <span className="radio" />
                </button>
              ))}
            </div>
          ))}

        {step === 1 && (
          <Calendar
            month={month}
            onMonth={setMonth}
            today={today}
            lastDay={lastDay}
            available={availableDates[mk]}
            selected={date}
            onSelect={(d) => {
              if (d !== date) resetFrom(1)
              setDate(d)
            }}
          />
        )}

        {step === 2 &&
          (slots === null ? (
            <Spinner label="Buscando barberos…" />
          ) : barbersForDay.length === 0 ? (
            <p className="empty">Ya no quedan espacios ese día. Vuelve y elige otra fecha.</p>
          ) : (
            <div className="option-list">
              <button className={`option ${barberId === null ? 'selected' : ''}`} onClick={() => (setBarberId(null), setTime(null))}>
                <span className="option-icon">
                  <Users size={26} />
                </span>
                <span className="option-text">
                  <strong>CUALQUIERA</strong>
                  <small>Primer barbero disponible</small>
                </span>
                <span className="radio" />
              </button>
              {barbersForDay.map((b) => (
                <button
                  key={b.id}
                  className={`option ${barberId === b.id ? 'selected' : ''}`}
                  onClick={() => (setBarberId(b.id), setTime(null))}
                >
                  <span className="option-icon avatar">
                    {b.photo_url ? <img src={b.photo_url} alt="" /> : b.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="option-text">
                    <strong>{b.name.toUpperCase()}</strong>
                    <small>{slots.filter((s) => s.barber_id === b.id).length} horarios libres</small>
                  </span>
                  <span className="radio" />
                </button>
              ))}
            </div>
          ))}

        {step === 3 &&
          (slots === null ? (
            <Spinner label="Buscando horarios…" />
          ) : times.length === 0 ? (
            <p className="empty">No quedan horas libres. Vuelve y elige otra fecha o barbero.</p>
          ) : (
            <div className="time-groups">
              {[
                ['Mañana', (t: string) => t < '12:00'],
                ['Tarde', (t: string) => t >= '12:00' && t < '18:00'],
                ['Noche', (t: string) => t >= '18:00'],
              ].map(([label, test]) => {
                const list = times.filter(test as (t: string) => boolean)
                if (!list.length) return null
                return (
                  <section key={label as string}>
                    <h3>{label as string}</h3>
                    <div className="time-grid">
                      {list.map((t) => (
                        <button key={t} className={`time ${time === t ? 'selected' : ''}`} onClick={() => setTime(t)}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ))}

        {step === 4 && service && date && time && (
          <>
            <div className="summary">
              <div>
                <span>Servicio</span>
                <strong>{service.name}</strong>
              </div>
              <div>
                <span>Fecha</span>
                <strong>{cap(longDate(date))}</strong>
              </div>
              <div>
                <span>Hora</span>
                <strong>{time}</strong>
              </div>
              <div>
                <span>Barbero</span>
                <strong>{barberName}</strong>
              </div>
              <div>
                <span>Precio</span>
                <strong>{crc(service.price)}</strong>
              </div>
            </div>
            <form className="form" onSubmit={(e) => (e.preventDefault(), canContinue() && !busy && void next())}>
              <label>
                <span>Nombre</span>
                <input
                  className="input"
                  autoComplete="name"
                  value={form.name}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="¿Cómo te llamas?"
                />
              </label>
              <label>
                <span>WhatsApp</span>
                <input
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  maxLength={20}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="8888 8888"
                />
              </label>
              <label>
                <span>
                  Correo <em>(opcional)</em>
                </span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="tucorreo@ejemplo.com"
                />
              </label>
              <label>
                <span>
                  Nota <em>(opcional)</em>
                </span>
                <textarea
                  className="input"
                  rows={2}
                  maxLength={300}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Algo que el barbero deba saber"
                />
              </label>
              <button type="submit" hidden />
            </form>
          </>
        )}
      </main>

      <footer className="pub-footer">
        <button className="btn-black" disabled={!canContinue() || busy} onClick={() => void next()}>
          {busy ? 'RESERVANDO…' : step === 4 ? 'CONFIRMAR RESERVA' : 'CONTINUAR'}
        </button>
      </footer>
    </div>
  )
}

interface CalendarProps {
  month: Date
  onMonth: (d: Date) => void
  today: string
  lastDay: string
  available?: Set<string>
  selected: string | null
  onSelect: (d: string) => void
}

function Calendar({ month, onMonth, today, lastDay, available, selected, onSelect }: CalendarProps) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const offset = new Date(year, m, 1).getDay()
  const days = new Date(year, m + 1, 0).getDate()
  const firstMonth = toISO(month) <= today
  const lastMonth = toISO(new Date(year, m + 1, 0)) >= lastDay

  return (
    <div className="calendar">
      <div className="cal-nav">
        <button className="cal-arrow" disabled={firstMonth} onClick={() => onMonth(new Date(year, m - 1, 1))} aria-label="Mes anterior">
          <ChevronLeft size={22} />
        </button>
        <h3>
          {cap(MONTHS[m])} De {year}
        </h3>
        <button className="cal-arrow" disabled={lastMonth} onClick={() => onMonth(new Date(year, m + 1, 1))} aria-label="Mes siguiente">
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d} className="cal-wd">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const iso = toISO(new Date(year, m, i + 1))
          const open = available?.has(iso) ?? false
          return (
            <button
              key={iso}
              disabled={!open}
              className={`cal-day ${open ? 'open' : ''} ${iso === today ? 'today' : ''} ${iso === selected ? 'selected' : ''}`}
              onClick={() => onSelect(iso)}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      {!available && <Spinner label="Buscando días disponibles…" />}
      {available && available.size === 0 && <p className="empty">No hay días disponibles este mes.</p>}
    </div>
  )
}

function Success({ booking, adminMode, onNew }: { booking: PublicBooking; adminMode: boolean; onNew: () => void }) {
  const rows: [string, React.ReactNode][] = [
    ['Servicio', booking.service_name],
    ['Fecha', cap(longDate(booking.date))],
    ['Hora', booking.start_time],
    ['Barbero', booking.barber_name],
    ['Precio', crcText(booking.price)],
    ['WhatsApp', booking.phone],
    ['Correo', booking.email || 'No indicado'],
    ['Estado', <StatusBadge key="s" status={booking.status} />],
    [
      'Código de check-in',
      <strong key="c" className="mono">
        {booking.code}
      </strong>,
    ],
    ['Comprobante', booking.email ? 'Enviado a tu correo' : 'No se indicó un correo'],
  ]
  return (
    <div className="pub success">
      <div className="success-check">✓</div>
      <h1 className="serif">¡Listo! Tu cita está reservada</h1>
      <p className="step-sub center">
        {booking.email ? 'Te enviamos la confirmación por correo y WhatsApp.' : 'Te enviamos la confirmación por WhatsApp.'}
      </p>
      <div className="printer">
        <div className="printer-top">
          <Send size={26} />
          <span className="printer-slot" />
        </div>
        <div className="receipt">
          {rows.map(([label, value], i) => (
            <div key={label} className={`receipt-row ${i === 5 ? 'dashed' : ''}`}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
          <div className="receipt-qr">
            <QRImage value={bookingUrl(booking.code)} size={150} />
            <small>{booking.code}</small>
          </div>
        </div>
      </div>
      <div className="success-actions">
        <Link className="btn-black" to={`/reserva/${booking.code}`}>
          VER MI RESERVA
        </Link>
        <button className="btn-line" onClick={onNew}>
          {adminMode ? 'VOLVER AL PANEL' : 'AGENDAR OTRA CITA'}
        </button>
      </div>
    </div>
  )
}
