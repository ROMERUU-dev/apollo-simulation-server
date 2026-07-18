import { apiGetJson, type ApiRequestOptions } from './client'
import type { CimaSimIdentity } from './types'

export function getIdentity(options?: ApiRequestOptions): Promise<CimaSimIdentity> {
  return apiGetJson<CimaSimIdentity>('/api/me', options)
}
