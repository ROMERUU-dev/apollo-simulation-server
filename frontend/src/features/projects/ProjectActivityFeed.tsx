import type { ActivityEntry } from '../../types'
import { formatDateTime } from '../../utils/format'

export function ProjectActivityFeed({ activity }: { activity: ActivityEntry[] }) {
  if (activity.length === 0) {
    return <p style={{ opacity: 0.6, fontSize: 13 }}>Sin actividad registrada.</p>
  }
  return (
    <ol style={{ margin: 0, padding: 0, borderLeft: '2px solid var(--color-divider)' }}>
      {activity.map((entry) => (
        <li
          key={entry.id}
          style={{ listStyle: 'none', padding: '4px 0 12px 16px', position: 'relative' }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: -5,
              top: 8,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-accent-600)',
            }}
          />
          <div style={{ fontSize: 13 }}>{entry.message}</div>
          <div style={{ fontSize: 11.5, opacity: 0.55 }}>{formatDateTime(entry.timestamp)}</div>
        </li>
      ))}
    </ol>
  )
}
