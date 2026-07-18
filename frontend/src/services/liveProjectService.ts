import type { ModelFile, Netlist, Project } from '../types'
import type { CreateProjectInput, ProjectListOptions, ProjectService } from './types'

function unavailable(): never {
  throw new Error('La creación de proyectos se habilitará con el motor de simulación.')
}

class LiveProjectService implements ProjectService {
  async list(_options?: ProjectListOptions): Promise<Project[]> {
    return []
  }

  async get(_projectId: string): Promise<Project | null> {
    return null
  }

  async create(_input: CreateProjectInput): Promise<Project> {
    unavailable()
  }

  async duplicate(_projectId: string): Promise<Project> {
    unavailable()
  }

  async archive(_projectId: string): Promise<Project> {
    unavailable()
  }

  async unarchive(_projectId: string): Promise<Project> {
    unavailable()
  }

  async remove(_projectId: string): Promise<void> {
    unavailable()
  }

  async addNetlist(_projectId: string, _netlist: Netlist): Promise<Project> {
    unavailable()
  }

  async addModelFile(_projectId: string, _modelFile: ModelFile): Promise<Project> {
    unavailable()
  }
}

export const projectService: ProjectService = new LiveProjectService()
