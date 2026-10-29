import { STATUS_LABEL } from '../lib/format'
import type { BookingStatus } from '../lib/types'

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
}
