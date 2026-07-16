import { mockProjects } from '../mocks/projects'
import type { ModelFile, Netlist, Project } from '../types'
import { createId } from '../utils/id'
import { delay } from '../utils/delay'
import type { CreateProjectInput, ProjectListOptions, ProjectService } from './types'

let projects: Project[] = mockProjects.map((p) => ({ ...p }))

function sortProjects(
  list: Project[],
  field: ProjectListOptions['sortField'],
  direction: ProjectListOptions['sortDirection'],
) {
  const sorted = [...list].sort((a, b) => {
    if (field === 'name') return a.name.localeCompare(b.name)
    const aValue = field === 'createdAt' ? a.createdAt : a.updatedAt
    const bValue = field === 'createdAt' ? b.createdAt : b.updatedAt
    return new Date(aValue).getTime() - new Date(bValue).getTime()
  })
  return direction === 'desc' ? sorted.reverse() : sorted
}

class MockProjectService implements ProjectService {
  async list(options: ProjectListOptions = {}): Promise<Project[]> {
    await delay()
    const { query = '', status = 'all', sortField = 'updatedAt', sortDirection = 'desc' } = options
    let result = projects
    if (status !== 'all') {
      result = result.filter((p) => p.status === status)
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }
    return sortProjects(result, sortField, sortDirection)
  }

  async get(projectId: string): Promise<Project | null> {
    await delay()
    return projects.find((p) => p.id === projectId) ?? null
  }

  async create(input: CreateProjectInput): Promise<Project> {
    await delay()
    const now = new Date().toISOString()
    const project: Project = {
      id: createId('proj'),
      name: input.name,
      description: input.description,
      tags: input.tags,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      netlists: [],
      modelFiles: [],
      simulationIds: [],
      activity: [
        { id: createId('act'), message: 'Proyecto creado', timestamp: now, kind: 'created' },
      ],
    }
    projects = [project, ...projects]
    return project
  }

  async duplicate(projectId: string): Promise<Project> {
    await delay()
    const source = projects.find((p) => p.id === projectId)
    if (!source) throw new Error(`Proyecto no encontrado: ${projectId}`)
    const now = new Date().toISOString()
    const copy: Project = {
      ...source,
      id: createId('proj'),
      name: `${source.name} (copia)`,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      activity: [
        {
          id: createId('act'),
          message: `Duplicado de "${source.name}"`,
          timestamp: now,
          kind: 'duplicate',
        },
      ],
    }
    projects = [copy, ...projects]
    return copy
  }

  async archive(projectId: string): Promise<Project> {
    return this.setStatus(projectId, 'archived', 'Proyecto archivado', 'archive')
  }

  async unarchive(projectId: string): Promise<Project> {
    return this.setStatus(projectId, 'active', 'Proyecto restaurado', 'archive')
  }

  private async setStatus(
    projectId: string,
    status: Project['status'],
    message: string,
    kind: Project['activity'][number]['kind'],
  ): Promise<Project> {
    await delay()
    const now = new Date().toISOString()
    let updated: Project | undefined
    projects = projects.map((p) => {
      if (p.id !== projectId) return p
      updated = {
        ...p,
        status,
        updatedAt: now,
        activity: [{ id: createId('act'), message, timestamp: now, kind }, ...p.activity],
      }
      return updated
    })
    if (!updated) throw new Error(`Proyecto no encontrado: ${projectId}`)
    return updated
  }

  async remove(projectId: string): Promise<void> {
    await delay()
    projects = projects.filter((p) => p.id !== projectId)
  }

  async addNetlist(projectId: string, netlist: Netlist): Promise<Project> {
    await delay()
    const now = new Date().toISOString()
    let updated: Project | undefined
    projects = projects.map((p) => {
      if (p.id !== projectId) return p
      updated = { ...p, netlists: [...p.netlists, netlist], updatedAt: now }
      return updated
    })
    if (!updated) throw new Error(`Proyecto no encontrado: ${projectId}`)
    return updated
  }

  async addModelFile(projectId: string, modelFile: ModelFile): Promise<Project> {
    await delay()
    const now = new Date().toISOString()
    let updated: Project | undefined
    projects = projects.map((p) => {
      if (p.id !== projectId) return p
      updated = { ...p, modelFiles: [...p.modelFiles, modelFile], updatedAt: now }
      return updated
    })
    if (!updated) throw new Error(`Proyecto no encontrado: ${projectId}`)
    return updated
  }
}

export const projectService: ProjectService = new MockProjectService()
