import { supabase } from './supabase'
import type { Barber, Booking, BusinessHour, Closure, PublicBooking, Service, Settings } from './types'

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

export const fetchServices = (all = false) => {
  let q = supabase.from('services').select('*').order('sort').order('name')
  if (!all) q = q.eq('active', true)
  return unwrap<Service[]>(q)
}

export const fetchBarbers = (all = false) => {
  let q = supabase.from('barbers').select('*').order('sort').order('name')
  if (!all) q = q.eq('active', true)
  return unwrap<Barber[]>(q)
}

export const fetchHours = () => unwrap<BusinessHour[]>(supabase.from('business_hours').select('*').order('weekday'))

export const fetchSettings = () => unwrap<Settings>(supabase.from('settings').select('*').eq('id', 1).single())

export const fetchClosures = (from: string) =>
  unwrap<Closure[]>(supabase.from('closures').select('*').gte('date', from).order('date').order('start_time'))

export const fetchAvailableDates = (serviceId: string, from: string, to: string, barberId: string | null = null) =>
  unwrap<string[]>(supabase.rpc('get_available_dates', { p_service_id: serviceId, p_from: from, p_to: to, p_barber_id: barberId }))

export const fetchSlots = (serviceId: string, date: string, barberId: string | null = null) =>
  unwrap<{ barber_id: string; start_time: string }[]>(
    supabase.rpc('get_available_slots', { p_service_id: serviceId, p_date: date, p_barber_id: barberId }),
  )

export interface NewBooking {
  serviceId: string
  barberId: string | null
  date: string
  time: string
  name: string
  phone: string
  email: string
  notes: string
}

export const createBooking = (b: NewBooking) =>
  unwrap<PublicBooking>(
    supabase.rpc('create_booking', {
      p_service_id: b.serviceId,
      p_barber_id: b.barberId,
      p_date: b.date,
      p_time: b.time,
      p_name: b.name,
      p_phone: b.phone,
      p_email: b.email || null,
      p_notes: b.notes || null,
    }),
  )

export const getBookingByCode = (code: string) => unwrap<PublicBooking | null>(supabase.rpc('get_booking_by_code', { p_code: code }))

export const cancelBookingPublic = (code: string, last4: string) =>
  unwrap<PublicBooking>(supabase.rpc('cancel_booking', { p_code: code, p_phone_last4: last4 }))

/** Envía correo y WhatsApp. Si falla no bloquea la reserva. */
export async function sendNotification(code: string, type: 'confirmation' | 'cancellation') {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', { body: { code, type } })
    if (error) throw error
    return data as { email?: string; whatsapp?: string }
  } catch (err) {
    console.warn('No se pudo enviar la notificación', err)
    return null
  }
}

// ---- Administración ----

export interface BookingQuery {
  from?: string
  to?: string
  statuses?: string[]
  search?: string
  limit?: number
  ascending?: boolean
}

export function fetchBookings(q: BookingQuery = {}) {
  const asc = q.ascending ?? true
  let query = supabase
    .from('bookings')
    .select('*')
    .order('date', { ascending: asc })
    .order('start_time', { ascending: asc })
    .limit(q.limit ?? 500)
  if (q.from) query = query.gte('date', q.from)
  if (q.to) query = query.lte('date', q.to)
  if (q.statuses?.length) query = query.in('status', q.statuses)
  if (q.search) {
    const s = q.search.replace(/[%,()]/g, ' ').trim()
    if (s) query = query.or(`client_name.ilike.%${s}%,phone.ilike.%${s}%,code.ilike.%${s}%`)
  }
  return unwrap<Booking[]>(query)
}

export const fetchBookingByCodeAdmin = (code: string) =>
  unwrap<Booking | null>(supabase.from('bookings').select('*').eq('code', code).maybeSingle())

export const updateBookingStatus = (id: string, status: Booking['status']) =>
  unwrap<Booking>(
    supabase
      .from('bookings')
      .update({ status, ...(status === 'cancelada' ? { cancelled_by: 'admin' } : {}) })
      .eq('id', id)
      .select()
      .single(),
  )

export const checkInBooking = (code: string) => unwrap<Booking>(supabase.rpc('check_in_booking', { p_code: code }))
