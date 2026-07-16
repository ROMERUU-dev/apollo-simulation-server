import { Search } from 'lucide-react'
import type { ProjectSortField, ProjectStatus, SortDirection } from '../../types'

interface ProjectFiltersProps {
  query: string
  onQueryChange: (value: string) => void
  status: ProjectStatus | 'all'
  onStatusChange: (value: ProjectStatus | 'all') => void
  sortField: ProjectSortField
  sortDirection: SortDirection
  onSortChange: (field: ProjectSortField, direction: SortDirection) => void
}

const SORT_OPTIONS: {
  value: string
  label: string
  field: ProjectSortField
  direction: SortDirection
}[] = [
  {
    value: 'updatedAt-desc',
    label: 'Actualizado (más reciente)',
    field: 'updatedAt',
    direction: 'desc',
  },
  {
    value: 'updatedAt-asc',
    label: 'Actualizado (más antiguo)',
    field: 'updatedAt',
    direction: 'asc',
  },
  {
    value: 'createdAt-desc',
    label: 'Creado (más reciente)',
    field: 'createdAt',
    direction: 'desc',
  },
  { value: 'name-asc', label: 'Nombre (A-Z)', field: 'name', direction: 'asc' },
]

export function ProjectFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
  sortField,
  sortDirection,
  onSortChange,
}: ProjectFiltersProps) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
      <label style={{ position: 'relative', flex: '1 1 240px' }}>
        <span className="visually-hidden">Buscar proyectos</span>
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
          placeholder="Buscar por nombre, descripción o etiqueta…"
          className="input"
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
          onChange={(e) => onStatusChange(e.target.value as ProjectStatus | 'all')}
          style={{
            padding: '9px 10px',
            border: '1px solid var(--color-divider)',
            background: 'var(--color-surface)',
            color: 'inherit',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="archived">Archivados</option>
        </select>
      </label>

      <label>
        <span className="visually-hidden">Ordenar</span>
        <select
          value={`${sortField}-${sortDirection}`}
          onChange={(e) => {
            const option = SORT_OPTIONS.find((o) => o.value === e.target.value)
            if (option) onSortChange(option.field, option.direction)
          }}
          style={{
            padding: '9px 10px',
            border: '1px solid var(--color-divider)',
            background: 'var(--color-surface)',
            color: 'inherit',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
