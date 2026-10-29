import { Droplets, Scissors } from 'lucide-react'
import type { ServiceIcon as IconName } from '../lib/types'

function Beard({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        d="M4 3h16v8.5c0 5-3.6 9.5-8 9.5s-8-4.5-8-9.5V3Zm4 9.2c1.2 1 2.5 1.5 4 1.5s2.8-.5 4-1.5v1.3c-1.2.9-2.5 1.3-4 1.3s-2.8-.4-4-1.3v-1.3Zm.5 4c1 .7 2.2 1 3.5 1s2.5-.3 3.5-1v1c-1 .8-2.2 1.2-3.5 1.2s-2.5-.4-3.5-1.2v-1Z"
        fillRule="evenodd"
      />
    </svg>
  )
}

export const SERVICE_ICONS: { value: IconName; label: string }[] = [
  { value: 'scissors', label: 'Corte' },
  { value: 'beard', label: 'Barba' },
  { value: 'combo', label: 'Corte + barba' },
  { value: 'flow', label: 'Lavado' },
]

export default function ServiceIcon({ icon, size = 22 }: { icon: IconName; size?: number }) {
  switch (icon) {
    case 'beard':
      return <Beard size={size} />
    case 'combo':
      return (
        <span className="icon-combo" style={{ width: size, height: size }}>
          <Scissors size={size * 0.62} strokeWidth={2.4} />
          <Beard size={size * 0.7} />
        </span>
      )
    case 'flow':
      return <Droplets size={size} strokeWidth={2.2} />
    default:
      return <Scissors size={size} strokeWidth={2.2} />
  }
}
