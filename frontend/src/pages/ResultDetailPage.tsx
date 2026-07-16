import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { ErrorState } from '../components/feedback/ErrorState'
import { Tabs } from '../components/navigation/Tabs'
import { ResultChart } from '../components/charts/ResultChart'
import { useResult } from '../hooks/useResults'
import { useJob } from '../hooks/useJobs'
import { SummaryTab } from '../features/results/SummaryTab'
import { RunsTab } from '../features/results/RunsTab'
import { FilesTab } from '../features/results/FilesTab'
import { LogsTab } from '../features/results/LogsTab'
import { ConfigTab } from '../features/results/ConfigTab'
import { ComparisonTab } from '../features/results/ComparisonTab'

export default function ResultDetailPage() {
  const { simulationId } = useParams<{ simulationId: string }>()
  const navigate = useNavigate()
  const { result, loading } = useResult(simulationId)
  const { job } = useJob(result?.jobId)

  if (loading) return <LoadingState label="Cargando resultados…" />
  if (!result) {
    return (
      <ErrorState
        title="Resultado no encontrado"
        description="Es posible que la simulación aún no haya finalizado o haya sido eliminada."
        onRetry={() => navigate('/results')}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title={result.simulationName}
        subtitle={`${result.projectName} · Resultados de simulación`}
      />
      <Tabs
        tabs={[
          { id: 'summary', label: 'Resumen', content: <SummaryTab result={result} /> },
          { id: 'charts', label: 'Gráficas', content: <ResultChart result={result} /> },
          { id: 'runs', label: 'Corridas', content: <RunsTab runs={job?.runs ?? []} /> },
          { id: 'files', label: 'Archivos', content: <FilesTab artifacts={result.artifacts} /> },
          { id: 'logs', label: 'Logs', content: <LogsTab logs={job?.logs ?? []} /> },
          {
            id: 'config',
            label: 'Configuración',
            content: <ConfigTab result={result} job={job} />,
          },
          {
            id: 'comparison',
            label: 'Comparación',
            content: <ComparisonTab runs={job?.runs ?? []} />,
          },
        ]}
      />
    </div>
  )
}
