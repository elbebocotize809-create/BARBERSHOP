import jsQR from 'jsqr'
import { AlertCircle, ArrowLeft, Camera, Check, ChevronRight, ImageIcon, QrCode, RefreshCw, ScanLine, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { checkInBooking, fetchBookingByCodeAdmin, updateBookingStatus } from '../lib/api'
import { errorMessage, extractCode, todayISO } from '../lib/format'
import type { Booking } from '../lib/types'
import Modal from './Modal'
import Ticket from './Ticket'

type CamState = 'starting' | 'on' | 'blocked' | 'unsupported'

function decodeImageData(img: ImageData): string | null {
  const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
  return res?.data ?? null
}

async function decodeFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
}

function statusMessage(b: Booking): { title: string; canStart: boolean; button: string } {
  const today = todayISO()
  switch (b.status) {
    case 'cancelada':
      return { title: 'Esta cita está cancelada', canStart: false, button: 'Cita cancelada' }
    case 'no_asistio':
      return { title: 'El cliente no asistió a esta cita', canStart: false, button: 'Cita cerrada' }
    case 'completada':
      return { title: 'Esta cita ya fue completada', canStart: false, button: 'Cita completada' }
    case 'en_curso':
      return { title: 'La cita está en curso', canStart: false, button: 'Marcar como completada' }
  }
  if (b.date > today) return { title: 'Todavía no se puede iniciar la cita', canStart: false, button: 'Disponible el día de la cita' }
  if (b.date < today) return { title: 'La fecha de esta cita ya pasó', canStart: false, button: 'Fecha vencida' }
  return { title: 'Cita lista para iniciar', canStart: true, button: 'Confirmar e iniciar cita' }
}

export default function Scanner({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const [cam, setCam] = useState<CamState>('starting')
  const [manual, setManual] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [done, setDone] = useState('')

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const lookup = useCallback(
    async (raw: string) => {
      const code = extractCode(raw)
      if (code.length < 4) {
        setError('El código no es válido.')
        return
      }
      setBusy(true)
      setError('')
      try {
        const b = await fetchBookingByCodeAdmin(code)
        if (!b) {
          setError(`No existe una reserva con el código ${code}.`)
          return
        }
        stopCamera()
        setDone('')
        setBooking(b)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setBusy(false)
      }
    },
    [stopCamera],
  )

  const startCamera = useCallback(async () => {
    stopCamera()
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam('unsupported')
      return
    }
    setCam('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setCam('on')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      let last = 0
      const tick = (t: number) => {
        rafRef.current = requestAnimationFrame(tick)
        if (t - last < 200 || video.readyState < 2) return
        last = t
        const w = video.videoWidth
        const h = video.videoHeight
        const scale = Math.min(1, 720 / Math.max(w, h))
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const text = decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
        if (text) {
          cancelAnimationFrame(rafRef.current)
          navigator.vibrate?.(60)
          void lookup(text)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setCam('blocked')
    }
  }, [lookup, stopCamera])

  useEffect(() => {
    void startCamera()
    return stopCamera
  }, [startCamera, stopCamera])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const text = await decodeFile(file)
      if (text) await lookup(text)
      else setError('No se encontró un código QR en la imagen.')
    } catch {
      setError('No se pudo leer la imagen.')
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    if (!booking) return
    setBusy(true)
    setError('')
    try {
      if (booking.status === 'en_curso') {
        setBooking(await updateBookingStatus(booking.id, 'completada'))
        setDone('Cita completada.')
      } else {
        setBooking(await checkInBooking(booking.code))
        setDone('Cita iniciada. ¡Buen servicio!')
      }
      onChanged?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function back() {
    setBooking(null)
    setError('')
    setManual('')
    void startCamera()
  }

  if (booking) {
    const msg = statusMessage(booking)
    const enabled = msg.canStart || booking.status === 'en_curso'
    return (
      <Modal
        full
        icon={<ScanLine size={40} />}
        title="Detalle de la cita"
        subtitle="Revisa la información y selecciona qué hacer con esta reserva."
        onClose={onClose}
        footer={
          <>
            <button className="btn btn-outline" onClick={onClose}>
              Cerrar
            </button>
            <button className="btn btn-primary grow" disabled={!enabled || busy} onClick={start}>
              <Check size={22} /> {msg.button}
            </button>
          </>
        }
      >
        <button className="link-back" onClick={back}>
          <ArrowLeft size={22} /> Atrás
        </button>
        <h3 className="detail-title">{done || msg.title}</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <Ticket variant="admin" booking={booking} />
        {booking.notes && <p className="muted note">Nota del cliente: {booking.notes}</p>}
      </Modal>
    )
  }

  return (
    <Modal
      full
      icon={<ScanLine size={40} />}
      title="Escanear cita"
      subtitle="Lee el QR del comprobante para ver los datos de la cita."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary grow" disabled>
            <Check size={22} /> Confirmar e iniciar cita
          </button>
        </>
      }
    >
      <div className="scan-view">
        <video ref={videoRef} playsInline muted className={cam === 'on' ? '' : 'hidden'} />
        <div className="scan-frame" />
        {cam !== 'on' && (
          <div className="scan-overlay">
            <strong>{cam === 'starting' ? 'Iniciando cámara…' : 'Cámara desactivada'}</strong>
            <span>{cam === 'starting' ? 'Permite el acceso si el navegador lo pide' : 'Activa el acceso para escanear tu QR'}</span>
          </div>
        )}
        {busy && <div className="scan-busy">Buscando…</div>}
      </div>

      <div className="card scan-actions">
        <button className="btn btn-soft" onClick={() => void startCamera()}>
          <RefreshCw size={22} /> Reintentar cámara
        </button>
        <label className="btn btn-outline">
          <Camera size={22} /> Capturar foto
          <input type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        </label>
        <label className="btn btn-outline">
          <ImageIcon size={22} /> Elegir imagen
          <input type="file" accept="image/*" hidden onChange={onFile} />
        </label>
      </div>

      {(cam === 'blocked' || cam === 'unsupported') && (
        <div className="alert alert-error alert-big">
          <AlertCircle size={28} />
          <div>
            <strong>{cam === 'blocked' ? 'Acceso a la cámara bloqueado' : 'Cámara no disponible'}</strong>
            <p>
              {cam === 'blocked'
                ? 'Permite la cámara en los ajustes del navegador y toca Reintentar; también puedes ingresar el código manualmente.'
                : 'Este navegador no permite usar la cámara aquí. Usa una foto o ingresa el código manualmente.'}
            </p>
          </div>
          <ChevronRight size={22} />
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <form
        className="card manual"
        onSubmit={(e) => {
          e.preventDefault()
          void lookup(manual)
        }}
      >
        <div className="manual-head">
          <QrCode size={30} />
          <div>
            <strong>¿No puedes usar la cámara?</strong>
            <p>Ingresa el código que aparece en el comprobante o en el correo de confirmación.</p>
          </div>
        </div>
        <div className="manual-row">
          <input
            className="input mono"
            placeholder="Ej. A7K9MP"
            value={manual}
            maxLength={12}
            autoCapitalize="characters"
            onChange={(e) => setManual(e.target.value.toUpperCase())}
          />
          <button className="btn btn-primary" disabled={busy || manual.trim().length < 4}>
            <Search size={22} /> Buscar cita
          </button>
        </div>
      </form>
    </Modal>
  )
}
