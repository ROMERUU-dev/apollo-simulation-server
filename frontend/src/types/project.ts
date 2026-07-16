export type ProjectStatus = 'active' | 'archived'

export interface Netlist {
  id: string
  name: string
  content: string
  createdAt: string
  updatedAt: string
  sizeBytes: number
}

export type ModelFileKind = 'lib' | 'mod' | 'model' | 'inc'

export interface ModelFile {
  id: string
  name: string
  kind: ModelFileKind
  sizeBytes: number
  referencedInNetlist: boolean
  missing: boolean
  uploadedAt: string
}

export interface ActivityEntry {
  id: string
  message: string
  timestamp: string
  kind: 'created' | 'simulation' | 'edit' | 'archive' | 'delete' | 'duplicate'
}

export interface Project {
  id: string
  name: string
  description: string
  tags: string[]
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  netlists: Netlist[]
  modelFiles: ModelFile[]
  simulationIds: string[]
  activity: ActivityEntry[]
}

export type ProjectSortField = 'updatedAt' | 'createdAt' | 'name'
export type SortDirection = 'asc' | 'desc'
