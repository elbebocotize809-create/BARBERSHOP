import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { errorMessage } from '../../lib/format'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const { session, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (!loading && session && profile?.role === 'admin') return <Navigate to="/admin" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : errorMessage(error))
    setBusy(false)
  }

  async function reset() {
    if (!email.trim()) {
      setError('Escribe tu correo para enviarte el enlace.')
      return
    }
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/admin/perfil` })
    if (error) setError(errorMessage(error))
    else setInfo('Te enviamos un enlace para cambiar la contraseña.')
  }

  return (
    <div className="adm login">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-logo">
          <LogIn size={30} />
        </div>
        <h1>Panel de administración</h1>
        <p className="muted">Ingresa con tu cuenta de administrador.</p>
        {session && profile && profile.role !== 'admin' && (
          <div className="alert alert-error">Tu cuenta ({session.user.email}) no tiene permisos de administrador.</div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {info && <div className="alert alert-ok">{info}</div>}
        <label className="field">
          <span>Correo</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          Olvidé mi contraseña
        </button>
        {session && (
          <button type="button" className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        )}
      </form>
    </div>
  )
}
