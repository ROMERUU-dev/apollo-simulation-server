import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { EmptyState } from '../components/feedback/EmptyState'
import { ConfirmDialog } from '../components/feedback/ConfirmDialog'
import { useJobs } from '../hooks/useJobs'
import { jobService } from '../services'
import type { JobStatus, SimulationJob } from '../types'
import { JobFilters, type JobSortOption } from '../features/jobs/JobFilters'
import { JobQueueTable } from '../features/jobs/JobQueueTable'

export default function JobsPage() {
  const { jobs, loading, refresh } = useJobs()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<JobStatus | 'all'>('all')
  const [sort, setSort] = useState<JobSortOption>('createdAt-desc')
  const [pendingDelete, setPendingDelete] = useState<SimulationJob | null>(null)

  const filteredJobs = useMemo(() => {
    let result = jobs
    if (status !== 'all') result = result.filter((j) => j.status === status)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(
        (j) => j.name.toLowerCase().includes(q) || j.projectName.toLowerCase().includes(q),
      )
    }
    const sorted = [...result]
    switch (sort) {
      case 'createdAt-asc':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'progressPct-desc':
        sorted.sort((a, b) => b.progressPct - a.progressPct)
        break
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return sorted
  }, [jobs, status, query, sort])

  async function handleCancel(job: SimulationJob) {
    await jobService.cancel(job.id)
    refresh()
  }

  async function handleRetry(job: SimulationJob) {
    await jobService.retry(job.id)
    refresh()
  }

  async function handleDuplicate(job: SimulationJob) {
    await jobService.duplicate(job.id)
    refresh()
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    await jobService.remove(pendingDelete.id)
    setPendingDelete(null)
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="Trabajos"
        subtitle="Cola de simulaciones en curso, completadas y fallidas"
      />

      <JobFilters
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        sort={sort}
        onSortChange={setSort}
      />

      {loading ? (
        <LoadingState label="Cargando trabajos…" />
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          title="Sin trabajos"
          description="Ajusta los filtros o crea una nueva simulación."
        />
      ) : (
        <JobQueueTable
          jobs={filteredJobs}
          onCancel={handleCancel}
          onRetry={handleRetry}
          onDuplicate={handleDuplicate}
          onDelete={setPendingDelete}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar trabajo"
        description={`¿Seguro que deseas eliminar "${pendingDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
