import { useCallback, useEffect, useState } from 'react'
import { projectService } from '../services'
import type { Project } from '../types'
import type { ProjectListOptions } from '../services/types'

export function useProjects(options?: ProjectListOptions) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const { query, status, sortField, sortDirection } = options ?? {}

  const refresh = useCallback(() => {
    setLoading(true)
    projectService.list({ query, status, sortField, sortDirection }).then((list) => {
      setProjects(list)
      setLoading(false)
    })
  }, [query, status, sortField, sortDirection])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { projects, loading, refresh }
}

export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!projectId) {
      setProject(null)
      setLoading(false)
      return
    }
    setLoading(true)
    projectService.get(projectId).then((result) => {
      setProject(result)
      setLoading(false)
    })
  }, [projectId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { project, loading, refresh }
}
