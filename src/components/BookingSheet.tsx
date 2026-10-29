import { Ban, Check, CheckCheck, ClipboardList, MessageCircle, Play, UserX } from 'lucide-react'
import { useState } from 'react'
import { checkInBooking, sendNotification, updateBookingStatus } from '../lib/api'
import { cap, errorMessage, hhmm, longDate, todayISO, waLink } from '../lib/format'
import type { Booking, BookingStatus } from '../lib/types'
import Modal from './Modal'
import Ticket from './Ticket'

export default function BookingSheet({
  booking,
  onClose,
  onChanged,
}: {
  booking: Booking
  onClose: () => void
  onChanged: (b: Booking) => void
}) {
  const [b, setB] = useState(booking)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)

  async function run(status: BookingStatus) {
    setBusy(true)
    setError('')
    try {
      const updated = status === 'en_curso' ? await checkInBooking(b.code) : await updateBookingStatus(b.id, status)
      setB(updated)
      onChanged(updated)
      if (status === 'cancelada') void sendNotification(updated.code, 'cancellation')
      setConfirmCancel(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const today = todayISO()
  const open = b.status === 'nueva' || b.status === 'confirmada'
  const waText = `Hola ${b.client_name}, te escribimos de la barbería sobre tu cita de ${b.service_name} el ${longDate(b.date).toLowerCase()} a las ${hhmm(b.start_time)} (código ${b.code}).`

  return (
    <Modal
      icon={<ClipboardList size={36} />}
      title="Detalle de la reserva"
      subtitle={`${cap(longDate(b.date))} · ${hhmm(b.start_time)}`}
      onClose={onClose}
    >
      {error && <div className="alert alert-error">{error}</div>}
      <Ticket variant="admin" booking={b} />
      {b.notes && <p className="muted note">Nota del cliente: {b.notes}</p>}
      <p className="muted small">
        Creada por {b.created_by === 'admin' ? 'el administrador' : 'el cliente'}
        {b.cancelled_by && ` · cancelada por ${b.cancelled_by === 'admin' ? 'el administrador' : 'el cliente'}`}
      </p>

      <div className="sheet-actions">
        {b.status === 'nueva' && (
          <button className="btn btn-soft" disabled={busy} onClick={() => run('confirmada')}>
            <Check size={20} /> Confirmar
          </button>
        )}
        {open && b.date === today && (
          <button className="btn btn-primary" disabled={busy} onClick={() => run('en_curso')}>
            <Play size={20} /> Iniciar cita
          </button>
        )}
        {(b.status === 'en_curso' || (open && b.date <= today)) && (
          <button className="btn btn-ok" disabled={busy} onClick={() => run('completada')}>
            <CheckCheck size={20} /> Completada
          </button>
        )}
        {open && b.date <= today && (
          <button className="btn btn-outline" disabled={busy} onClick={() => run('no_asistio')}>
            <UserX size={20} /> No asistió
          </button>
        )}
        <a className="btn btn-outline" href={waLink(b.phone, waText)} target="_blank" rel="noreferrer">
          <MessageCircle size={20} /> WhatsApp
        </a>
        {open &&
          (confirmCancel ? (
            <button className="btn btn-danger" disabled={busy} onClick={() => run('cancelada')}>
              <Ban size={20} /> ¿Seguro? Cancelar
            </button>
          ) : (
            <button className="btn btn-outline danger" disabled={busy} onClick={() => setConfirmCancel(true)}>
              <Ban size={20} /> Cancelar reserva
            </button>
          ))}
      </div>
    </Modal>
  )
}
