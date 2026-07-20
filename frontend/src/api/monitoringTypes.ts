export type MonitoringStatus = 'healthy' | 'degraded' | 'unavailable'
export type MonitoringRange = '15m' | '1h' | '6h' | '24h'

export interface MonitoringSummary {
  generated_at: string
  status: MonitoringStatus
  host: {
    cpu_percent: number
    load_1: number
    memory_percent: number
    root_disk_percent: number
    data_disk_percent: number
    temperature_celsius: number | null
    uptime_seconds: number
  }
  cimasim: {
    backend_up: boolean
    spool_ready: boolean
    queued: number
    running: number
    completed_total: number
    failed_total: number
    p95_duration_seconds: number | null
  }
  alerts: Array<{ name: string; severity: 'warning' | 'critical'; state: 'pending' | 'firing' }>
}

export interface MonitoringHistory {
  generated_at: string
  range: MonitoringRange
  series: Array<{ key: string; points: Array<{ timestamp: string; value: number }> }>
}
