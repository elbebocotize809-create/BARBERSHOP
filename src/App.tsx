import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Spinner from './components/Spinner'
import { AuthProvider } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import Booking from './pages/public/Booking'
import BookingDetail from './pages/public/BookingDetail'

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Agenda = lazy(() => import('./pages/admin/Agenda'))
const Barbers = lazy(() => import('./pages/admin/Barbers'))
const Clients = lazy(() => import('./pages/admin/Clients'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Hours = lazy(() => import('./pages/admin/Hours'))
const Login = lazy(() => import('./pages/admin/Login'))
const Profile = lazy(() => import('./pages/admin/Profile'))
const Reservations = lazy(() => import('./pages/admin/Reservations'))
const Services = lazy(() => import('./pages/admin/Services'))
const Stats = lazy(() => import('./pages/admin/Stats'))

function SetupNeeded() {
  return (
    <div className="pub">
      <main className="pub-main">
        <h1 className="page-title">Falta configurar Supabase</h1>
        <p className="step-sub">
          Copia <code>.env.example</code> a <code>.env</code> y completa <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>. En Netlify, agrégalas como variables de entorno y vuelve a publicar. Los pasos completos
          están en el README.
        </p>
      </main>
    </div>
  )
}

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner label="Cargando…" />}>
          <Routes>
            <Route path="/" element={<Booking />} />
            <Route path="/reserva/:code" element={<BookingDetail />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="estadisticas" element={<Stats />} />
              <Route path="reservas" element={<Reservations />} />
              <Route path="historial" element={<Reservations history />} />
              <Route path="horarios" element={<Hours />} />
              <Route path="servicios" element={<Services />} />
              <Route path="barberos" element={<Barbers />} />
              <Route path="clientes" element={<Clients />} />
              <Route path="perfil" element={<Profile />} />
              <Route
                path="agendar"
                element={
                  <div className="embedded-booking">
                    <Booking adminMode />
                  </div>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
