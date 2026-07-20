import { Navigate, useParams } from 'react-router-dom'

export default function ResultDetailPage() {
  const { simulationId } = useParams<{ simulationId: string }>()
  return <Navigate to={simulationId ? `/jobs/${simulationId}` : '/results'} replace />
}
