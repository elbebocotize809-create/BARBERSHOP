import { ArrowLeft, CalendarCheck, CircleX, Clock, QrCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Logo from '../../components/Logo'
import QRImage from '../../components/QRImage'
import Spinner from '../../components/Spinner'
import Ticket from '../../components/Ticket'
import { cancelBookingPublic, getBookingByCode, sendNotification } from '../../lib/api'
import { bookingUrl, errorMessage, nowHHMM, todayISO, waLink } from '../../lib/format'
import type { PublicBooking } from '../../lib/types'

const SHOP_WHATSAPP = import.meta.env.VITE_SHOP_WHATSAPP as string | undefined

export default function BookingDetail() {
  const { code = '' } = useParams()
  const [booking, setBooking] = useState<PublicBooking | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [last4, setLast4] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getBookingByCode(code)
      .then(setBooking)
      .catch((err) => {
        setError(errorMessage(err))
        setBooking(null)
      })
  }, [code])

  async function cancel() {
    setBusy(true)
    setError('')
    try {
      const b = await cancelBookingPublic(code, last4)
      setBooking(b)
      setCancelling(false)
      void sendNotification(b.code, 'cancellation')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <header className="pub-header">
      <div className="pub-header-side" />
      <Logo />
      <div className="pub-header-side right">
        <Link className="pub-link" to="/">
          Salir
        </Link>
      </div>
    </header>
  )

  if (booking === undefined)
    return (
      <div className="pub">
        {header}
        <Spinner label="Buscando tu reserva…" />
      </div>
    )

  if (!booking)
    return (
      <div className="pub">
        {header}
        <main className="pub-main">
          <h1 className="page-title">Reserva no encontrada</h1>
          <p className="step-sub">{error || `No existe una reserva con el código ${code.toUpperCase()}.`}</p>
          <Link className="btn-line" to="/">
            <ArrowLeft size={20} /> VOLVER
          </Link>
        </main>
      </div>
    )

  const isCancelled = booking.status === 'cancelada'
  const isPast = booking.date < todayISO() || (booking.date === todayISO() && booking.start_time <= nowHHMM())
  const canCancel = (booking.status === 'nueva' || booking.status === 'confirmada') && !isPast

  const titles: Record<string, [React.ReactNode, string, string]> = {
    cancelada: [<CircleX key="i" size={30} />, 'Reserva cancelada', 'Esta cita ya fue cancelada y no se puede modificar.'],
    completada: [<CalendarCheck key="i" size={30} />, 'Cita completada', '¡Gracias por visitarnos! Te esperamos pronto.'],
    en_curso: [<Clock key="i" size={30} />, 'Cita en curso', 'Tu servicio ya comenzó.'],
    no_asistio: [<CircleX key="i" size={30} />, 'Cita vencida', 'Esta cita se marcó como no asistida.'],
  }
  const [icon, title, sub] = titles[booking.status] ?? [
    <CalendarCheck key="i" size={30} />,
    'Tu reserva',
    isPast ? 'La hora de esta cita ya pasó.' : 'Presenta el código QR al llegar a la barbería.',
  ]

  return (
    <div className="pub">
      {header}
      <main className="pub-main detail">
        <div className="detail-head">
          <span className="detail-icon">{icon}</span>
          <h1>{title}</h1>
        </div>
        <p className="step-sub">{sub}</p>
        {isCancelled && <div className="notice">Esta cita está cancelada.</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <Ticket booking={booking} showIcons />

        <div className="qr-card">
          <div>
            <div className="qr-card-title">
              <span className="detail-icon sm">
                <QrCode size={22} />
              </span>
              <strong>Código QR de tu reserva</strong>
            </div>
            <p>
              {isCancelled
                ? 'Esta reserva está cancelada. El QR queda como referencia y no permite iniciar el servicio.'
                : 'Muéstralo al llegar para iniciar tu cita. También puedes dar el código manual.'}
            </p>
          </div>
          <div className="qr-box">
            <QRImage value={bookingUrl(booking.code)} size={130} className={isCancelled ? 'faded' : ''} />
            <small>Código manual: {booking.code}</small>
          </div>
        </div>

        {canCancel && !cancelling && (
          <button className="btn-line danger" onClick={() => setCancelling(true)}>
            CANCELAR RESERVA
          </button>
        )}
        {cancelling && (
          <div className="cancel-box">
            <p>
              Para confirmar, escribe los <strong>últimos 4 dígitos</strong> del WhatsApp con el que reservaste ({booking.phone}).
            </p>
            <input
              className="input mono"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
            />
            <div className="row-gap">
              <button className="btn-line" onClick={() => setCancelling(false)}>
                NO, VOLVER
              </button>
              <button className="btn-black danger" disabled={last4.length !== 4 || busy} onClick={cancel}>
                {busy ? 'CANCELANDO…' : 'SÍ, CANCELAR'}
              </button>
            </div>
          </div>
        )}

        {SHOP_WHATSAPP && !isCancelled && (
          <a className="btn-line" href={waLink(SHOP_WHATSAPP, `Hola, tengo la reserva ${booking.code}`)} target="_blank" rel="noreferrer">
            ESCRIBIR A LA BARBERÍA
          </a>
        )}
        <Link className="btn-line" to="/">
          <ArrowLeft size={20} /> VOLVER
        </Link>
      </main>
    </div>
  )
}
