import type {
  ExecutionConfig,
  ModelFile,
  Netlist,
  ParameterDefinition,
  Project,
  ProjectSortField,
  ProjectStatus,
  ServerStatus,
  SimulationConfig,
  SimulationJob,
  SimulationResult,
  SortDirection,
  SimulatorId,
} from '../types'

export interface ProjectListOptions {
  query?: string
  status?: ProjectStatus | 'all'
  sortField?: ProjectSortField
  sortDirection?: SortDirection
}

export interface CreateProjectInput {
  name: string
  description: string
  tags: string[]
}

/**
 * Contract for project CRUD. The mock implementation lives in-memory today;
 * a future HTTP implementation can satisfy this interface unchanged.
 */
export interface ProjectService {
  list(options?: ProjectListOptions): Promise<Project[]>
  get(projectId: string): Promise<Project | null>
  create(input: CreateProjectInput): Promise<Project>
  duplicate(projectId: string): Promise<Project>
  archive(projectId: string): Promise<Project>
  unarchive(projectId: string): Promise<Project>
  remove(projectId: string): Promise<void>
  addNetlist(projectId: string, netlist: Netlist): Promise<Project>
  addModelFile(projectId: string, modelFile: ModelFile): Promise<Project>
}

export interface NetlistTemplate {
  id: string
  name: string
  description: string
  content: string
}

/** Contract for netlist templates and validation, independent of any project. */
export interface SimulationService {
  listTemplates(): Promise<NetlistTemplate[]>
  validateNetlist(content: string): { valid: boolean; message?: string }
  createConfig(input: {
    projectId: string
    name: string
    netlistId: string
    netlistContent: string
    modelFileIds: string[]
    simulatorId: SimulatorId
    parameters: ParameterDefinition[]
    execution: ExecutionConfig
  }): Promise<SimulationConfig>
}

export interface JobService {
  list(): Promise<SimulationJob[]>
  get(jobId: string): Promise<SimulationJob | null>
  createFromConfig(config: SimulationConfig, projectName: string): Promise<SimulationJob>
  cancel(jobId: string): Promise<SimulationJob>
  retry(jobId: string): Promise<SimulationJob>
  duplicate(jobId: string): Promise<SimulationJob>
  remove(jobId: string): Promise<void>
  simulateCompletion(jobId: string): Promise<SimulationJob>
  simulateFailure(jobId: string): Promise<SimulationJob>
  subscribe(listener: () => void): () => void
}

export interface ResultService {
  list(): Promise<SimulationResult[]>
  get(resultId: string): Promise<SimulationResult | null>
  getByJobId(jobId: string): Promise<SimulationResult | null>
}

export interface ServerStatusService {
  get(): Promise<ServerStatus>
  subscribe(listener: () => void): () => void
}
