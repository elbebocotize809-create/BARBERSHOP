export type BookingStatus = 'nueva' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada' | 'no_asistio'

export type ServiceIcon = 'scissors' | 'beard' | 'combo' | 'flow'

export interface Service {
  id: string
  name: string
  category: string
  price: number
  duration_min: number
  icon: ServiceIcon
  active: boolean
  sort: number
}

export interface Barber {
  id: string
  name: string
  phone: string | null
  photo_url: string | null
  active: boolean
  sort: number
}

export interface BusinessHour {
  weekday: number
  is_open: boolean
  open_time: string
  close_time: string
  break_start: string | null
  break_end: string | null
}

export interface Closure {
  id: string
  date: string
  barber_id: string | null
  start_time: string | null
  end_time: string | null
  reason: string | null
}

export interface Settings {
  id: number
  shop_name: string
  timezone: string
  slot_interval_min: number
  min_notice_min: number
  booking_window_days: number
}

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: 'admin' | 'pendiente'
}

/** Fila completa de bookings (solo administradores). */
export interface Booking {
  id: string
  code: string
  client_id: string | null
  client_name: string
  phone: string
  email: string | null
  notes: string | null
  service_id: string | null
  service_name: string
  barber_id: string | null
  barber_name: string
  date: string
  start_time: string
  end_time: string
  duration_min: number
  price: number
  status: BookingStatus
  created_by: 'cliente' | 'admin'
  cancelled_by: 'cliente' | 'admin' | null
  created_at: string
  checked_in_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

/** Lo que devuelven las funciones públicas (create_booking, get_booking_by_code). */
export interface PublicBooking {
  code: string
  client_name: string
  phone: string
  email: string | null
  service_name: string
  barber_name: string
  date: string
  start_time: string
  end_time: string
  duration_min: number
  price: number
  status: BookingStatus
  created_at: string
}

export interface ClientStats {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  created_at: string
  bookings_count: number
  completed_count: number
  no_show_count: number
  total_spent: number
  last_visit: string | null
  next_booking: string | null
}
