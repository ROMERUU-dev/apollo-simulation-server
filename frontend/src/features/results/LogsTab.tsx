import type { LogEntry } from '../../types'
import { LiveLogPanel } from '../jobs/LiveLogPanel'

export function LogsTab({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return (
      <p style={{ opacity: 0.6, fontSize: 13 }}>Sin registros disponibles para esta simulación.</p>
    )
  }
  return <LiveLogPanel logs={logs} />
}
