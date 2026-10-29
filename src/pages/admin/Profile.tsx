import { Cpu, LogOut, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import { errorMessage } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { useAdmin } from './AdminContext'

export default function Profile() {
  const { session, profile, reloadProfile } = useAuth()
  const { theme, toggleTheme } = useAdmin()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setError('')
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', session!.user.id)
    if (error) setError(errorMessage(error))
    else {
      setMsg('Nombre actualizado.')
      await reloadProfile()
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(errorMessage(error))
    else {
      setPassword('')
      setMsg('Contraseña actualizada.')
    }
  }

  return (
    <div className="page">
      <section className="card profile-card">
        <span className="avatar-lg">
          <Cpu size={52} />
        </span>
        <div>
          <h3>{profile?.full_name || 'Administrador'}</h3>
          <p className="muted">{session?.user.email}</p>
        </div>
      </section>
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      <form className="card form" onSubmit={saveName}>
        <h3 className="card-title">Tu nombre</h3>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <button className="btn btn-soft">Guardar nombre</button>
      </form>

      <form className="card form" onSubmit={savePassword}>
        <h3 className="card-title">Cambiar contraseña</h3>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Nueva contraseña (mínimo 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn btn-soft" disabled={password.length < 8}>
          Cambiar contraseña
        </button>
      </form>

      <section className="card form">
        <button className="btn btn-outline" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />} {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button className="btn btn-outline danger" onClick={() => supabase.auth.signOut()}>
          <LogOut size={22} /> Cerrar sesión
        </button>
      </section>
    </div>
  )
}
