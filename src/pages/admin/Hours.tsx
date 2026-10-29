import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchBarbers, fetchClosures, fetchHours, fetchSettings } from '../../lib/api'
import { cap, errorMessage, hhmm, longDate, todayISO, WEEKDAYS } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Barber, BusinessHour, Closure, Settings } from '../../lib/types'

const EMPTY_CLOSURE = { date: '', barber_id: '', allDay: true, start_time: '12:00', end_time: '13:00', reason: '' }

export default function Hours() {
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [closures, setClosures] = useState<Closure[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [form, setForm] = useState(EMPTY_CLOSURE)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [h, s, c, b] = await Promise.all([fetchHours(), fetchSettings(), fetchClosures(todayISO()), fetchBarbers(true)])
      setHours(
        h.map((x) => ({
          ...x,
          open_time: hhmm(x.open_time),
          close_time: hhmm(x.close_time),
          break_start: x.break_start && hhmm(x.break_start),
          break_end: x.break_end && hhmm(x.break_end),
        })),
      )
      setSettings(s)
      setClosures(c)
      setBarbers(b)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function setHour(weekday: number, patch: Partial<BusinessHour>) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)))
  }

  async function saveHours() {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const rows = hours.map((h) => ({
        ...h,
        break_start: h.break_start || null,
        break_end: h.break_start ? h.break_end || null : null,
      }))
      const { error } = await supabase.from('business_hours').upsert(rows)
      if (error) throw error
      if (settings) {
        const { error: e2 } = await supabase
          .from('settings')
          .update({
            slot_interval_min: settings.slot_interval_min,
            min_notice_min: settings.min_notice_min,
            booking_window_days: settings.booking_window_days,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1)
        if (e2) throw e2
      }
      setMsg('Horario guardado.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function addClosure(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('closures').insert({
      date: form.date,
      barber_id: form.barber_id || null,
      start_time: form.allDay ? null : form.start_time,
      end_time: form.allDay ? null : form.end_time,
      reason: form.reason.trim() || null,
    })
    if (error) setError(errorMessage(error))
    else {
      setForm(EMPTY_CLOSURE)
      setClosures(await fetchClosures(todayISO()))
    }
  }

  async function removeClosure(id: string) {
    const { error } = await supabase.from('closures').delete().eq('id', id)
    if (error) setError(errorMessage(error))
    else setClosures((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="page">
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      <section className="card">
        <h3 className="card-title">Horario semanal</h3>
        <div className="hours">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const h = hours.find((x) => x.weekday === wd)
            if (!h) return null
            return (
              <div className={`hour-row ${h.is_open ? '' : 'closed'}`} key={wd}>
                <label className="check day">
                  <input type="checkbox" checked={h.is_open} onChange={(e) => setHour(wd, { is_open: e.target.checked })} />
                  {WEEKDAYS[wd]}
                </label>
                {h.is_open ? (
                  <div className="hour-fields">
                    <span>
                      <input
                        type="time"
                        className="input sm"
                        value={h.open_time}
                        onChange={(e) => setHour(wd, { open_time: e.target.value })}
                      />
                      a
                      <input
                        type="time"
                        className="input sm"
                        value={h.close_time}
                        onChange={(e) => setHour(wd, { close_time: e.target.value })}
                      />
                    </span>
                    <span className="muted small">
                      Almuerzo
                      <input
                        type="time"
                        className="input sm"
                        value={h.break_start ?? ''}
                        onChange={(e) =>
                          setHour(wd, {
                            break_start: e.target.value || null,
                            break_end: e.target.value ? h.break_end || e.target.value : null,
                          })
                        }
                      />
                      a
                      <input
                        type="time"
                        className="input sm"
                        value={h.break_end ?? ''}
                        disabled={!h.break_start}
                        onChange={(e) => setHour(wd, { break_end: e.target.value || null })}
                      />
                    </span>
                  </div>
                ) : (
                  <span className="muted">Cerrado</span>
                )}
              </div>
            )
          })}
        </div>

        {settings && (
          <div className="settings-grid">
            <label className="field">
              <span>Intervalo entre horarios (min)</span>
              <input
                type="number"
                className="input"
                min={5}
                max={120}
                step={5}
                value={settings.slot_interval_min}
                onChange={(e) => setSettings({ ...settings, slot_interval_min: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Anticipación mínima (min)</span>
              <input
                type="number"
                className="input"
                min={0}
                step={15}
                value={settings.min_notice_min}
                onChange={(e) => setSettings({ ...settings, min_notice_min: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Reservar con hasta (días)</span>
              <input
                type="number"
                className="input"
                min={1}
                max={365}
                value={settings.booking_window_days}
                onChange={(e) => setSettings({ ...settings, booking_window_days: Number(e.target.value) })}
              />
            </label>
          </div>
        )}
        <button className="btn btn-primary wide" disabled={busy} onClick={saveHours}>
          {busy ? 'Guardando…' : 'Guardar horario'}
        </button>
      </section>

      <section className="card">
        <h3 className="card-title">Cierres y días libres</h3>
        <p className="muted small">
          Bloquea un día o unas horas para toda la barbería o para un barbero. Las citas ya agendadas no se cancelan.
        </p>
        <form className="closure-form" onSubmit={addClosure}>
          <label className="field">
            <span>Fecha</span>
            <input
              type="date"
              className="input"
              required
              min={todayISO()}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Aplica a</span>
            <select className="input" value={form.barber_id} onChange={(e) => setForm({ ...form, barber_id: e.target.value })}>
              <option value="">Toda la barbería</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} /> Todo el día
          </label>
          {!form.allDay && (
            <span className="row-gap">
              <input
                type="time"
                className="input sm"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
              a
              <input
                type="time"
                className="input sm"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </span>
          )}
          <label className="field">
            <span>Motivo (opcional)</span>
            <input
              className="input"
              value={form.reason}
              maxLength={120}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Feriado, vacaciones…"
            />
          </label>
          <button className="btn btn-soft">
            <Plus size={20} /> Agregar cierre
          </button>
        </form>

        <div className="list">
          {closures.length === 0 && <p className="empty">No hay cierres programados.</p>}
          {closures.map((c) => (
            <div className="row-item" key={c.id}>
              <div>
                <strong>{cap(longDate(c.date))}</strong>
                <span className="muted small">
                  {c.start_time ? `${hhmm(c.start_time)} – ${hhmm(c.end_time)}` : 'Todo el día'} ·{' '}
                  {c.barber_id ? (barbers.find((b) => b.id === c.barber_id)?.name ?? 'Barbero') : 'Toda la barbería'}
                  {c.reason && ` · ${c.reason}`}
                </span>
              </div>
              <button className="icon-btn danger" onClick={() => removeClosure(c.id)} aria-label="Eliminar cierre">
                <Trash2 size={22} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
