import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, Search } from 'lucide-react'
import type { LogEntry } from '../../types'
import styles from './LiveLogPanel.module.css'

function levelClass(level: LogEntry['level']) {
  return {
    info: styles['level-info'],
    warn: styles['level-warn'],
    error: styles['level-error'],
    debug: styles['level-debug'],
  }[level]
}

export function LiveLogPanel({ logs }: { logs: LogEntry[] }) {
  const [paused, setPaused] = useState(false)
  const [frozenLogs, setFrozenLogs] = useState<LogEntry[]>(logs)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!paused) setFrozenLogs(logs)
  }, [logs, paused])

  const visibleLogs = paused ? frozenLogs : logs

  const filtered = useMemo(() => {
    if (!search.trim()) return visibleLogs
    const q = search.trim().toLowerCase()
    return visibleLogs.filter((entry) => entry.message.toLowerCase().includes(q))
  }, [visibleLogs, search])

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <Search size={14} aria-hidden="true" style={{ opacity: 0.6 }} />
        <label style={{ flex: 1 }}>
          <span className="visually-hidden">Buscar en el registro</span>
          <input
            className={styles.searchInput}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en el registro…"
          />
        </label>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
        >
          {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
          {paused ? 'Reanudar' : 'Pausar'}
        </button>
      </div>
      <ul className={styles.list} aria-live={paused ? 'off' : 'polite'}>
        {filtered.length === 0 && (
          <li style={{ opacity: 0.5, padding: '6px 0' }}>Sin entradas de registro.</li>
        )}
        {filtered.map((entry) => (
          <li key={entry.id} className={styles.line}>
            <span className={styles.timestamp}>
              {new Date(entry.timestamp).toLocaleTimeString('es')}
            </span>
            <span className={levelClass(entry.level)}>{entry.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
