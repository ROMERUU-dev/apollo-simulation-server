import { Link } from 'react-router-dom'
import { LineChart } from 'lucide-react'
import type { SimulationResult } from '../../types'
import { formatRelativeTime } from '../../utils/format'

export function ResultListItemCompact({ result }: { result: SimulationResult }) {
  return (
    <li style={{ listStyle: 'none', borderBottom: '1px solid var(--color-divider)' }}>
      <Link
        to={`/results/${result.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 4px',
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <LineChart size={16} aria-hidden="true" style={{ opacity: 0.6, flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.simulationName}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.6 }}>
            {result.projectName} · {formatRelativeTime(result.createdAt)}
          </div>
        </div>
      </Link>
    </li>
  )
}
