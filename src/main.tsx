import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

try {
  const t = localStorage.getItem('barbershop.theme')
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t
} catch {
  /* almacenamiento no disponible */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
