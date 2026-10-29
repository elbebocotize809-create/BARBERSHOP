import { MessageCircle, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import BookingCard from '../../components/BookingCard'
import BookingSheet from '../../components/BookingSheet'
import Modal from '../../components/Modal'
import { cap, crc, errorMessage, longDate, waLink } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Booking, ClientStats } from '../../lib/types'

export default function Clients() {
  const [clients, setClients] = useState<ClientStats[] | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ClientStats | null>(null)
  const [history, setHistory] = useState<Booking[]>([])
  const [open, setOpen] = useState<Booking | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      let q = supabase.from('client_stats').select('*').order('last_visit', { ascending: false, nullsFirst: false }).limit(300)
      const s = search.replace(/[%,()]/g, ' ').trim()
      if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`)
      const { data, error } = await q
      if (error) setError(errorMessage(error))
      else setClients(data as ClientStats[])
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!selected) return
    supabase
      .from('bookings')
      .select('*')
      .eq('client_id', selected.id)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(50)
      .then(({ data }) => setHistory((data as Booking[]) ?? []))
  }, [selected])

  return (
    <div className="page">
      <div className="search">
        <Search size={22} />
        <input placeholder="Buscar cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {clients && <p className="muted small">{clients.length} clientes</p>}
      <div className="list">
        {clients?.length === 0 && <p className="empty">Todavía no hay clientes.</p>}
        {clients?.map((c) => (
          <button className="row-item clickable" key={c.id} onClick={() => setSelected(c)}>
            <span className="option-icon avatar">{c.name.slice(0, 1).toUpperCase()}</span>
            <div className="grow">
              <strong>{c.name}</strong>
              <span className="muted small">
                {c.phone} · {c.completed_count} visitas · {crc(c.total_spent)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <Modal title={selected.name} subtitle={selected.phone} onClose={() => (setSelected(null), setHistory([]))}>
          <div className="kpis">
            <div className="card kpi">
              <span>Visitas</span>
              <strong>{selected.completed_count}</strong>
            </div>
            <div className="card kpi">
              <span>Total gastado</span>
              <strong>{crc(selected.total_spent)}</strong>
            </div>
            <div className="card kpi">
              <span>Última visita</span>
              <strong className="sm">{selected.last_visit ? cap(longDate(selected.last_visit)) : '—'}</strong>
            </div>
            <div className="card kpi">
              <span>No asistió</span>
              <strong>{selected.no_show_count}</strong>
            </div>
          </div>
          {selected.email && <p className="muted">{selected.email}</p>}
          <a className="btn btn-outline wide" href={waLink(selected.phone)} target="_blank" rel="noreferrer">
            <MessageCircle size={20} /> Escribir por WhatsApp
          </a>
          <h3 className="card-title">Reservas</h3>
          <div className="list">
            {history.map((b) => (
              <BookingCard key={b.id} booking={b} onClick={() => setOpen(b)} />
            ))}
          </div>
        </Modal>
      )}
      {open && (
        <BookingSheet
          booking={open}
          onClose={() => setOpen(null)}
          onChanged={(u) => setHistory((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
        />
      )}
    </div>
  )
}
