import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, PlayCircle, Save } from 'lucide-react'
import { simulationService, jobService, projectService } from '../../../services'
import { WizardStepper } from './WizardStepper'
import { NetlistStep } from './steps/NetlistStep'
import { FilesStep } from './steps/FilesStep'
import { SimulatorStep } from './steps/SimulatorStep'
import { ParametersStep } from './steps/ParametersStep'
import { ExecutionStep } from './steps/ExecutionStep'
import { ReviewStep } from './steps/ReviewStep'
import { createInitialWizardState, type WizardState } from './wizardTypes'

interface NewSimulationWizardProps {
  initialProjectId: string | null
}

export function NewSimulationWizard({ initialProjectId }: NewSimulationWizardProps) {
  const navigate = useNavigate()
  const [state, setState] = useState<WizardState>(() => createInitialWizardState(initialProjectId))
  const [currentStep, setCurrentStep] = useState(0)
  const [furthestStep, setFurthestStep] = useState(0)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function patchState(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }))
  }

  const validation = useMemo(
    () => simulationService.validateNetlist(state.netlistContent),
    [state.netlistContent],
  )

  const canAdvance = useMemo(() => {
    switch (currentStep) {
      case 0:
        return validation.valid && state.simulationName.trim().length > 0
      case 2:
        return state.simulatorId !== null
      default:
        return true
    }
  }, [currentStep, validation.valid, state.simulationName, state.simulatorId])

  function goToStep(step: number) {
    setCurrentStep(step)
    setFurthestStep((f) => Math.max(f, step))
  }

  function handleNext() {
    if (!canAdvance) return
    if (currentStep === 0) patchState({ savedNetlistContent: state.netlistContent })
    goToStep(Math.min(currentStep + 1, 5))
  }

  function handleBack() {
    goToStep(Math.max(currentStep - 1, 0))
  }

  async function handleSaveConfig() {
    if (!state.simulatorId) return
    await simulationService.createConfig({
      projectId: state.projectId ?? '',
      name: state.simulationName,
      netlistId: state.netlistFileName ?? 'inline-netlist',
      netlistContent: state.netlistContent,
      modelFileIds: state.associatedFiles.map((f) => f.id),
      simulatorId: state.simulatorId,
      parameters: state.parameters,
      execution: state.execution,
    })
    setSaved(true)
  }

  async function handleStartSimulation() {
    if (!state.simulatorId || submitting) return
    setSubmitting(true)
    try {
      const config = await simulationService.createConfig({
        projectId: state.projectId ?? '',
        name: state.simulationName,
        netlistId: state.netlistFileName ?? 'inline-netlist',
        netlistContent: state.netlistContent,
        modelFileIds: state.associatedFiles.map((f) => f.id),
        simulatorId: state.simulatorId,
        parameters: state.parameters,
        execution: state.execution,
      })
      let projectName = 'Sin proyecto asignado'
      if (state.projectId) {
        const project = await projectService.get(state.projectId)
        if (project) projectName = project.name
      }
      const job = await jobService.createFromConfig(config, projectName)
      navigate(`/jobs/${job.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <WizardStepper
        currentStep={currentStep}
        furthestStep={furthestStep}
        onStepSelect={goToStep}
      />

      <div style={{ marginBottom: 24 }}>
        {currentStep === 0 && <NetlistStep state={state} onChange={patchState} />}
        {currentStep === 1 && <FilesStep state={state} onChange={patchState} />}
        {currentStep === 2 && <SimulatorStep state={state} onChange={patchState} />}
        {currentStep === 3 && <ParametersStep state={state} onChange={patchState} />}
        {currentStep === 4 && <ExecutionStep state={state} onChange={patchState} />}
        {currentStep === 5 && (
          <ReviewStep state={state} onChange={patchState} onJumpToStep={goToStep} />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
            opacity: currentStep === 0 ? 0.5 : 1,
          }}
        >
          <ChevronLeft size={16} aria-hidden="true" /> Atrás
        </button>

        {currentStep < 5 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: canAdvance ? 'pointer' : 'not-allowed',
              opacity: canAdvance ? 1 : 0.5,
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
              borderColor: 'var(--color-accent)',
            }}
          >
            Siguiente <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {saved && (
              <span role="status" style={{ fontSize: 12.5, color: 'var(--status-ok)' }}>
                Configuración guardada
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveConfig}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Save size={16} aria-hidden="true" /> Guardar configuración
            </button>
            <button
              type="button"
              onClick={handleStartSimulation}
              disabled={submitting || !state.simulatorId}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: submitting ? 'wait' : 'pointer',
                background: 'var(--color-accent)',
                color: 'var(--color-bg)',
                borderColor: 'var(--color-accent)',
              }}
            >
              <PlayCircle size={16} aria-hidden="true" />{' '}
              {submitting ? 'Iniciando…' : 'Iniciar simulación'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
