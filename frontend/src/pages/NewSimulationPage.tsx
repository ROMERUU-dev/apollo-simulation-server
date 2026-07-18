import { useLocation } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { NewSimulationWizard } from '../features/simulations/wizard/NewSimulationWizard'

interface NewSimulationLocationState {
  projectId?: string
}

export default function NewSimulationPage() {
  const location = useLocation()
  const state = location.state as NewSimulationLocationState | null
  const initialProjectId = state?.projectId ?? null

  return (
    <div>
      <PageHeader
        title="Nueva simulación"
        subtitle="Vista previa del flujo; ejecución real aún no habilitada"
      />
      <NewSimulationWizard key={initialProjectId ?? 'none'} initialProjectId={initialProjectId} />
    </div>
  )
}
