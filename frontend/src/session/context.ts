import { createContext } from 'react'
import type { CimaSimHealth, CimaSimIdentity } from '../api/types'

export interface SessionContextValue {
  identity: CimaSimIdentity | null
  health: CimaSimHealth | null
  loading: boolean
  error: string | null
  refreshIdentity: () => Promise<void>
  refreshHealth: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)
