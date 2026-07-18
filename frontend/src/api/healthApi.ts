import { apiGetJson, type ApiRequestOptions } from './client'
import type { CimaSimHealth } from './types'

export function getHealth(options?: ApiRequestOptions): Promise<CimaSimHealth> {
  return apiGetJson<CimaSimHealth>('/api/health', options)
}
