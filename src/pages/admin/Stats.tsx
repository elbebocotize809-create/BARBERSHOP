import { useEffect, useMemo, useState } from 'react'
import { fetchBookings } from '../../lib/api'
import { addDays, crc, errorMessage, parseISO, todayISO, WEEKDAYS } from '../../lib/format'
import type { Booking } from '../../lib/types'
import { useAdmin } from './AdminContext'

const RANGES = [7, 30, 90, 365]

function Bars({ rows, money = false }: { rows: { label: string; value: number }[]; money?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="empty">Sin datos en este periodo.</p>
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="bar-value">{money ? crc(r.value) : r.value}</span>
        </div>
      ))}
    </div>
  )
}

function group(list: Booking[], key: (b: Booking) => string, value: (b: Booking) => number = () => 1) {
  const map = new Map<string, number>()
  for (const b of list) map.set(key(b), (map.get(key(b)) ?? 0) + value(b))
  return [...map.entries()].map(([label, v]) => ({ label, value: v })).sort((a, b) => b.value - a.value)
}

export default function Stats() {
  const { refreshKey } = useAdmin()
  const [days, setDays] = useState(30)
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [error, setError] = useState('')
  const today = todayISO()

  useEffect(() => {
    fetchBookings({ from: addDays(today, -days + 1), to: today, limit: 5000 })
      .then(setBookings)
      .catch((err) => setError(errorMessage(err)))
  }, [days, today, refreshKey])

  const data = useMemo(() => {
    const all = bookings ?? []
    const done = all.filter((b) => b.status === 'completada')
    const cancelled = all.filter((b) => b.status === 'cancelada')
    const noShow = all.filter((b) => b.status === 'no_asistio')
    const active = all.filter((b) => b.status !== 'cancelada')
    const revenue = done.reduce((s, b) => s + b.price, 0)
    const byWeekday = WEEKDAYS.map((label, i) => ({
      label: label.slice(0, 3),
      value: active.filter((b) => parseISO(b.date).getDay() === i).length,
    }))
    const byHour = group(active, (b) => b.start_time.slice(0, 2) + ':00').sort((a, b) => a.label.localeCompare(b.label))
    return {
      total: all.length,
      done: done.length,
      revenue,
      avg: done.length ? revenue / done.length : 0,
      cancelRate: all.length ? Math.round((cancelled.length / all.length) * 100) : 0,
      noShowRate: all.length ? Math.round((noShow.length / all.length) * 100) : 0,
      byService: group(
        done,
        (b) => b.service_name,
        (b) => b.price,
      ),
      byBarber: group(
        done,
        (b) => b.barber_name,
        (b) => b.price,
      ),
      byBarberCount: group(active, (b) => b.barber_name),
      byWeekday,
      byHour,
      online: all.length ? Math.round((all.filter((b) => b.created_by === 'cliente').length / all.length) * 100) : 0,
    }
  }, [bookings])

  return (
    <div className="page">
      <div className="tabs">
        {RANGES.map((r) => (
          <button key={r} className={days === r ? 'on' : ''} onClick={() => setDays(r)}>
            {r === 365 ? '1 año' : `${r} días`}
          </button>
        ))}
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="kpis">
        <div className="card kpi">
          <span>Ingresos</span>
          <strong>{crc(data.revenue)}</strong>
          <small>{data.done} citas completadas</small>
        </div>
        <div className="card kpi">
          <span>Ticket promedio</span>
          <strong>{crc(data.avg)}</strong>
          <small>por cita completada</small>
        </div>
        <div className="card kpi">
          <span>Reservas</span>
          <strong>{data.total}</strong>
          <small>{data.online}% en línea</small>
        </div>
        <div className="card kpi">
          <span>Cancelaciones</span>
          <strong>{data.cancelRate}%</strong>
          <small>{data.noShowRate}% no asistió</small>
        </div>
      </div>

      <section className="card">
        <h3 className="card-title">Ingresos por servicio</h3>
        <Bars rows={data.byService} money />
      </section>
      <section className="card">
        <h3 className="card-title">Ingresos por barbero</h3>
        <Bars rows={data.byBarber} money />
      </section>
      <section className="card">
        <h3 className="card-title">Citas por barbero</h3>
        <Bars rows={data.byBarberCount} />
      </section>
      <section className="card">
        <h3 className="card-title">Citas por día de la semana</h3>
        <Bars rows={data.byWeekday} />
      </section>
      <section className="card">
        <h3 className="card-title">Horas más solicitadas</h3>
        <Bars rows={data.byHour} />
      </section>
    </div>
  )
}
