import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export default function QRImage({ value, size = 180, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' }).then((url) => {
      if (alive) setSrc(url)
    })
    return () => {
      alive = false
    }
  }, [value, size])
  return src ? (
    <img className={className} src={src} width={size} height={size} alt="Código QR de la reserva" />
  ) : (
    <div className={className} style={{ width: size, height: size }} />
  )
}
