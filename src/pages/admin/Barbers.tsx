import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import { fetchBarbers } from '../../lib/api'
import { errorMessage } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Barber } from '../../lib/types'

type Draft = Omit<Barber, 'id'> & { id?: string }

const EMPTY: Draft = { name: '', phone: '', photo_url: '', active: true, sort: 0 }

export default function Barbers() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    fetchBarbers(true)
      .then(setBarbers)
      .catch((err) => setError(errorMessage(err)))
  useEffect(() => {
    void load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    setError('')
    const { id, ...rest } = draft
    const row = { ...rest, name: rest.name.trim(), phone: rest.phone?.trim() || null, photo_url: rest.photo_url?.trim() || null }
    const { error } = id ? await supabase.from('barbers').update(row).eq('id', id) : await supabase.from('barbers').insert(row)
    setBusy(false)
    if (error) setError(errorMessage(error))
    else {
      setDraft(null)
      void load()
    }
  }

  async function remove(b: Barber) {
    if (!confirm(`¿Eliminar a ${b.name}? Sus reservas pasadas se conservan. Si solo deja de trabajar por un tiempo, mejor desactívalo.`))
      return
    const { error } = await supabase.from('barbers').delete().eq('id', b.id)
    if (error) setError(errorMessage(error))
    else void load()
  }

  return (
    <div className="page">
      {error && !draft && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary wide" onClick={() => setDraft({ ...EMPTY, sort: barbers.length + 1 })}>
        <Plus size={22} /> Nuevo barbero
      </button>
      <div className="list">
        {barbers.map((b) => (
          <div className={`row-item ${b.active ? '' : 'inactive'}`} key={b.id}>
            <span className="option-icon avatar">{b.photo_url ? <img src={b.photo_url} alt="" /> : b.name.slice(0, 1).toUpperCase()}</span>
            <div className="grow">
              <strong>{b.name}</strong>
              <span className="muted small">
                {b.phone || 'Sin teléfono'}
                {!b.active && ' · Inactivo'}
              </span>
            </div>
            <button
              className="icon-btn"
              onClick={() => setDraft({ ...b, phone: b.phone ?? '', photo_url: b.photo_url ?? '' })}
              aria-label="Editar"
            >
              <Pencil size={22} />
            </button>
            <button className="icon-btn danger" onClick={() => remove(b)} aria-label="Eliminar">
              <Trash2 size={22} />
            </button>
          </div>
        ))}
      </div>

      {draft && (
        <Modal title={draft.id ? 'Editar barbero' : 'Nuevo barbero'} onClose={() => setDraft(null)}>
          <form className="form" onSubmit={save}>
            {error && <div className="alert alert-error">{error}</div>}
            <label className="field">
              <span>Nombre</span>
              <input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Teléfono</span>
              <input
                className="input"
                type="tel"
                value={draft.phone ?? ''}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </label>
            <label className="field">
              <span>URL de la foto (opcional)</span>
              <input
                className="input"
                type="url"
                value={draft.photo_url ?? ''}
                onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })}
              />
            </label>
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
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Recibe
                reservas
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
