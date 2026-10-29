import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import ServiceIcon, { SERVICE_ICONS } from '../../components/ServiceIcon'
import { fetchServices } from '../../lib/api'
import { crc, errorMessage } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Service } from '../../lib/types'

type Draft = Omit<Service, 'id'> & { id?: string }

const EMPTY: Draft = { name: '', category: 'Servicio de barbería', price: 0, duration_min: 30, icon: 'scissors', active: true, sort: 0 }

export default function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    fetchServices(true)
      .then(setServices)
      .catch((err) => setError(errorMessage(err)))
  useEffect(() => {
    void load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    setError('')
    const { id, ...row } = draft
    const { error } = id ? await supabase.from('services').update(row).eq('id', id) : await supabase.from('services').insert(row)
    setBusy(false)
    if (error) setError(errorMessage(error))
    else {
      setDraft(null)
      void load()
    }
  }

  async function remove(s: Service) {
    if (!confirm(`¿Eliminar "${s.name}"? Las reservas existentes se conservan.`)) return
    const { error } = await supabase.from('services').delete().eq('id', s.id)
    if (error) setError(errorMessage(error))
    else void load()
  }

  return (
    <div className="page">
      {error && !draft && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary wide" onClick={() => setDraft({ ...EMPTY, sort: services.length + 1 })}>
        <Plus size={22} /> Nuevo servicio
      </button>
      <div className="list">
        {services.map((s) => (
          <div className={`row-item ${s.active ? '' : 'inactive'}`} key={s.id}>
            <span className="option-icon">
              <ServiceIcon icon={s.icon} />
            </span>
            <div className="grow">
              <strong>{s.name}</strong>
              <span className="muted small">
                {s.category} · {s.duration_min} min · {crc(s.price)}
                {!s.active && ' · Oculto'}
              </span>
            </div>
            <button className="icon-btn" onClick={() => setDraft(s)} aria-label="Editar">
              <Pencil size={22} />
            </button>
            <button className="icon-btn danger" onClick={() => remove(s)} aria-label="Eliminar">
              <Trash2 size={22} />
            </button>
          </div>
        ))}
      </div>

      {draft && (
        <Modal title={draft.id ? 'Editar servicio' : 'Nuevo servicio'} onClose={() => setDraft(null)}>
          <form className="form" onSubmit={save}>
            {error && <div className="alert alert-error">{error}</div>}
            <label className="field">
              <span>Nombre</span>
              <input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Descripción corta</span>
              <input className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </label>
            <div className="two">
              <label className="field">
                <span>Precio (₡)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={500}
                  required
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>Duración (min)</span>
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  required
                  value={draft.duration_min}
                  onChange={(e) => setDraft({ ...draft, duration_min: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="field">
              <span>Ícono</span>
              <div className="icon-pick">
                {SERVICE_ICONS.map((i) => (
                  <button
                    type="button"
                    key={i.value}
                    className={draft.icon === i.value ? 'on' : ''}
                    onClick={() => setDraft({ ...draft, icon: i.value })}
                    title={i.label}
                  >
                    <ServiceIcon icon={i.value} />
                  </button>
                ))}
              </div>
            </div>
            <div className="two">
              <label className="field">
                <span>Orden</span>
                <input
                  className="input"
                  type="number"
                  value={draft.sort}
                  onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) })}
                />
              </label>
              <label className="check">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Visible
                para clientes
              </label>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
