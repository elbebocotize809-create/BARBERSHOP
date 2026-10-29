import { createContext, useContext } from 'react'

export interface AdminCtx {
  /** Aumenta cada vez que llega un cambio en tiempo real de las reservas. */
  refreshKey: number
  live: boolean
  openScanner: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

export const AdminContext = createContext<AdminCtx>({
  refreshKey: 0,
  live: false,
  openScanner: () => {},
  theme: 'light',
  toggleTheme: () => {},
})

export const useAdmin = () => useContext(AdminContext)
