import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { EmptyState } from '../components/feedback/EmptyState'
import { useResults } from '../hooks/useResults'
import { ResultListItemCompact } from '../features/results/ResultListItemCompact'

export default function ResultsIndexPage() {
  const { results, loading } = useResults()

  return (
    <div>
      <PageHeader title="Resultados" subtitle="Simulaciones completadas y sus resultados" />
      {loading ? (
        <LoadingState label="Cargando resultados…" />
      ) : results.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Los resultados aparecerán aquí al completarse simulaciones."
        />
      ) : (
        <div style={{ border: '1px solid var(--color-divider)', padding: '0 10px', maxWidth: 640 }}>
          <ul style={{ margin: 0, padding: 0 }}>
            {results.map((result) => (
              <ResultListItemCompact key={result.id} result={result} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
