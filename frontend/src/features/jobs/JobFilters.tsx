import { Search } from 'lucide-react'
import type { JobStatus } from '../../types'

export type JobSortOption = 'createdAt-desc' | 'createdAt-asc' | 'progressPct-desc' | 'name-asc'

interface JobFiltersProps {
  query: string
  onQueryChange: (value: string) => void
  status: JobStatus | 'all'
  onStatusChange: (value: JobStatus | 'all') => void
  sort: JobSortOption
  onSortChange: (value: JobSortOption) => void
}

export function JobFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
}: JobFiltersProps) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
      <label style={{ position: 'relative', flex: '1 1 240px' }}>
        <span className="visually-hidden">Buscar trabajos</span>
        <Search
          size={15}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: 0.55,
          }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar por nombre o proyecto…"
          style={{
            width: '100%',
            padding: '9px 12px 9px 32px',
            border: '1px solid var(--color-divider)',
            background: 'var(--color-surface)',
            color: 'inherit',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      </label>

      <label>
        <span className="visually-hidden">Filtrar por estado</span>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as JobStatus | 'all')}
          style={{
            padding: '9px 10px',
            border: '1px solid var(--color-divider)',
            background: 'var(--color-surface)',
            color: 'inherit',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <option value="all">Todos los estados</option>
          <option value="queued">En cola</option>
          <option value="running">Ejecutando</option>
          <option value="completed">Completados</option>
          <option value="failed">Fallidos</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </label>

      <label>
        <span className="visually-hidden">Ordenar</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as JobSortOption)}
          style={{
            padding: '9px 10px',
            border: '1px solid var(--color-divider)',
            background: 'var(--color-surface)',
            color: 'inherit',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <option value="createdAt-desc">Creado (más reciente)</option>
          <option value="createdAt-asc">Creado (más antiguo)</option>
          <option value="progressPct-desc">Progreso (mayor primero)</option>
          <option value="name-asc">Nombre (A-Z)</option>
        </select>
      </label>
    </div>
  )
}
