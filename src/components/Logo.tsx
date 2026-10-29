import { SHOP_NAME } from '../lib/brand'

export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'logo-sm' : ''}`}>
      <span className="logo-name">{SHOP_NAME.toUpperCase()}</span>
      <span className="logo-sub">BARBERSHOP</span>
    </div>
  )
}
