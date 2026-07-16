import type { ExecutionConfig, ModelFile, ParameterDefinition, SimulatorId } from '../../../types'

export type NetlistSource = 'paste' | 'upload' | 'template'

export interface WizardState {
  projectId: string | null
  simulationName: string
  netlistSource: NetlistSource
  netlistContent: string
  savedNetlistContent: string
  netlistFileName: string | null
  selectedTemplateId: string | null
  associatedFiles: ModelFile[]
  simulatorId: SimulatorId | null
  parameters: ParameterDefinition[]
  execution: ExecutionConfig
}

export const WIZARD_STEP_LABELS = [
  'Netlist',
  'Archivos',
  'Simulador',
  'Parámetros',
  'Ejecución',
  'Revisión',
] as const

export function createInitialWizardState(projectId: string | null): WizardState {
  return {
    projectId,
    simulationName: '',
    netlistSource: 'paste',
    netlistContent: '',
    savedNetlistContent: '',
    netlistFileName: null,
    selectedTemplateId: null,
    associatedFiles: [],
    simulatorId: null,
    parameters: [],
    execution: {
      parallelJobs: 4,
      timeoutSeconds: 300,
      priority: 'normal',
      onFailure: 'skip-and-continue',
      keepIntermediateFiles: false,
      reservedThreads: 4,
      reservedRamGb: 4,
    },
  }
}
