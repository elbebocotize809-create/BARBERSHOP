import {
  BarChart3,
  Bell,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Clock,
  Cpu,
  History,
  House,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  ScanLine,
  Scissors,
  Sun,
  Sunrise,
  Sunset,
  User,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Scanner from '../../components/Scanner'
import Spinner from '../../components/Spinner'
import { useAuth } from '../../lib/auth'
import { greeting } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'
import { AdminContext } from './AdminContext'

const MENU = [
  { to: '/admin', label: 'Dashboard / Inicio', icon: LayoutGrid, end: true },
  { to: '/admin/agenda', label: 'Agenda de reservas', icon: CalendarDays },
  { to: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
  { to: '/admin/historial', label: 'Historial de reservas', icon: History },
  { to: '/admin/horarios', label: 'Horarios / Cierres', icon: Clock },
  { to: '/admin/servicios', label: 'Servicios', icon: Scissors },
  { to: '/admin/barberos', label: 'Barberos', icon: UserRound },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
]

const TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/agenda': 'Agenda',
  '/admin/estadisticas': 'Estadísticas',
  '/admin/reservas': 'Reservas',
  '/admin/historial': 'Historial',
  '/admin/horarios': 'Horarios',
  '/admin/servicios': 'Servicios',
  '/admin/barberos': 'Barberos',
  '/admin/clientes': 'Clientes',
  '/admin/perfil': 'Perfil',
  '/admin/agendar': 'Agendar cita',
}

export default function AdminLayout() {
  const { session, profile, loading } = useAuth()
  const { theme, toggle } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [drawer, setDrawer] = useState(false)
  const [scanner, setScanner] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [live, setLive] = useState(false)
  const [unseen, setUnseen] = useState(0)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) return
    const channel = supabase
      .channel('bookings-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        setRefreshKey((k) => k + 1)
        if (payload.eventType === 'INSERT') setUnseen((n) => n + 1)
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isAdmin])

  useEffect(() => setDrawer(false), [location.pathname])

  const ctx = useMemo(
    () => ({ refreshKey, live, openScanner: () => setScanner(true), theme, toggleTheme: toggle }),
    [refreshKey, live, theme, toggle],
  )

  if (loading) return <Spinner label="Cargando…" />
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace />

  const hello = greeting()
  const GreetIcon = hello === 'Buenos días' ? Sunrise : hello === 'Buenas tardes' ? Sun : Sunset

  return (
    <AdminContext.Provider value={ctx}>
      <div className="adm">
        <header className="adm-header">
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Menú">
            <Menu size={28} />
          </button>
          <h1>{(TITLES[location.pathname] ?? 'Panel').toUpperCase()}</h1>
          <button
            className="icon-btn bell"
            aria-label="Nuevas reservas"
            onClick={() => {
              setUnseen(0)
              navigate('/admin/reservas?f=nueva')
            }}
          >
            <Bell size={26} />
            {unseen > 0 && <span className="dot" />}
          </button>
          <NavLink to="/admin/perfil" className="avatar-btn" aria-label="Perfil">
            <Cpu size={30} />
          </NavLink>
        </header>

        <main className="adm-main">
          <Outlet />
        </main>

        {location.pathname !== '/admin/agendar' && (
          <button className="fab" onClick={() => setScanner(true)} aria-label="Escanear cita">
            <ScanLine size={30} />
          </button>
        )}

        <nav className="bottom-nav">
          <NavLink to="/admin" end>
            <House size={26} />
            <span>INICIO</span>
          </NavLink>
          <NavLink to="/admin/horarios">
            <Clock size={26} />
            <span>HORARIOS Y CIERRES</span>
          </NavLink>
          <NavLink to="/admin/agendar" className="nav-center">
            <span className="nav-center-btn">
              <CalendarPlus size={30} />
            </span>
            <span>AGENDAR CITA</span>
          </NavLink>
          <NavLink to="/admin/reservas">
            <CalendarDays size={26} />
            <span>RESERVAS</span>
          </NavLink>
          <NavLink to="/admin/perfil">
            <User size={26} />
            <span>PERFIL</span>
          </NavLink>
        </nav>

        {drawer && (
          <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
            <aside className="drawer" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-head">
                <Scissors size={26} />
                <strong>ADMIN</strong>
                <button className="icon-btn" onClick={() => setDrawer(false)} aria-label="Cerrar menú">
                  <X size={26} />
                </button>
              </div>
              <nav className="drawer-nav">
                {MENU.map((m) => (
                  <NavLink key={m.to} to={m.to} end={m.end}>
                    <m.icon size={26} strokeWidth={1.8} />
                    {m.label}
                  </NavLink>
                ))}
              </nav>
              <div className="drawer-foot">
                <div className="greet">
                  <span>
                    <GreetIcon size={22} />
                  </span>
                  {hello}
                </div>
                <button className="drawer-item" onClick={toggle}>
                  {theme === 'dark' ? <Sun size={26} /> : <Moon size={26} />}
                  {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                </button>
                <button className="btn btn-outline wide" onClick={() => supabase.auth.signOut()}>
                  <LogOut size={22} /> Salir
                </button>
              </div>
            </aside>
          </div>
        )}

        {scanner && <Scanner onClose={() => setScanner(false)} onChanged={() => setRefreshKey((k) => k + 1)} />}
      </div>
    </AdminContext.Provider>
  )
}
