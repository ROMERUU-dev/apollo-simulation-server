import { apiGetJson, type ApiRequestOptions } from './client'
import type { MonitoringHistory, MonitoringRange, MonitoringSummary } from './monitoringTypes'

export function getMonitoringSummary(options: ApiRequestOptions = {}) {
  return apiGetJson<MonitoringSummary>('/api/admin/monitoring/summary', {
    ...options,
    timeoutMs: 3500,
  })
}

export function getMonitoringHistory(range: MonitoringRange, options: ApiRequestOptions = {}) {
  return apiGetJson<MonitoringHistory>(
    `/api/admin/monitoring/history?range=${encodeURIComponent(range)}`,
    { ...options, timeoutMs: 3500 },
  )
}
