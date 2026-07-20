import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactEChartsCoreImport from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { ApiError } from '../api/errors'
import { getMonitoringHistory, getMonitoringSummary } from '../api/monitoringApi'
import type { MonitoringHistory, MonitoringRange, MonitoringSummary } from '../api/monitoringTypes'
import { ErrorState } from '../components/feedback/ErrorState'
import { LoadingState } from '../components/feedback/LoadingState'
import { PageHeader } from '../components/layout/PageHeader'

const ranges: MonitoringRange[] = ['15m', '1h', '6h', '24h']

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

type MaybeWrapped<T> = T | { default: MaybeWrapped<T> }
function unwrapDefault<T>(module: MaybeWrapped<T>): T {
  let current: MaybeWrapped<T> = module
  while (
    typeof current !== 'function' &&
    current !== null &&
    typeof current === 'object' &&
    'default' in current
  ) {
    current = current.default
  }
  return current as T
}

const ReactEChartsCore = unwrapDefault<typeof ReactEChartsCoreImport>(ReactEChartsCoreImport)

function metric(value: number, suffix = '') {
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })}${suffix}`
}

export default function AdminMonitoringPage() {
  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [history, setHistory] = useState<MonitoringHistory | null>(null)
  const [range, setRange] = useState<MonitoringRange>('1h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const failures = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    try {
      const [newSummary, newHistory] = await Promise.all([
        getMonitoringSummary({ signal: next.signal }),
        getMonitoringHistory(range, { signal: next.signal }),
      ])
      setSummary(newSummary)
      setHistory(newHistory)
      setError(null)
      failures.current = 0
    } catch (caught) {
      if (next.signal.aborted) return
      failures.current += 1
      if (caught instanceof ApiError && caught.status === 403) {
        setError('Esta vista no está disponible.')
      } else if (caught instanceof ApiError && caught.status === 401) {
        setError('La sesión expiró o no está disponible.')
      } else {
        setError('La monitorización no está disponible temporalmente.')
      }
    } finally {
      if (!next.signal.aborted) setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    void refresh()
    const timer = window.setInterval(() => {
      if (!document.hidden && failures.current < 3) void refresh()
    }, 15_000)
    const onVisibility = () => {
      if (!document.hidden && failures.current < 3) void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      controller.current?.abort()
    }
  }, [refresh])

  const chartOption = useMemo(
    () => ({
      animation: false,
      tooltip: { trigger: 'axis' },
      legend: { data: history?.series.map((item) => item.key) ?? [] },
      grid: { left: 52, right: 20, top: 45, bottom: 42 },
      xAxis: { type: 'time' },
      yAxis: { type: 'value' },
      series:
        history?.series.map((item) => ({
          name: item.key,
          type: 'line',
          showSymbol: false,
          data: item.points.map((point) => [point.timestamp, point.value]),
        })) ?? [],
    }),
    [history],
  )

  if (loading && !summary) return <LoadingState label="Consultando monitorización…" />
  if (error && !summary)
    return <ErrorState title="Monitorización no disponible" description={error} />
  if (!summary) return null

  const statusLabel = {
    healthy: 'Saludable',
    degraded: 'Degradado',
    unavailable: 'No disponible',
  }[summary.status]
  const failureRate =
    summary.cimasim.completed_total === 0
      ? 0
      : (summary.cimasim.failed_total / summary.cimasim.completed_total) * 100

  const cards = [
    ['CPU', metric(summary.host.cpu_percent, '%')],
    ['Carga 1 min', metric(summary.host.load_1)],
    ['RAM usada', metric(summary.host.memory_percent, '%')],
    ['Disco raíz', metric(summary.host.root_disk_percent, '%')],
    ['Disco de datos', metric(summary.host.data_disk_percent, '%')],
    [
      'Temperatura',
      summary.host.temperature_celsius === null
        ? 'No disponible'
        : metric(summary.host.temperature_celsius, ' °C'),
    ],
    ['En cola', String(summary.cimasim.queued)],
    ['Ejecutando', String(summary.cimasim.running)],
    ['Completados', String(summary.cimasim.completed_total)],
    ['Fallidos', String(summary.cimasim.failed_total)],
    ['Tasa de fallos', metric(failureRate, '%')],
    [
      'Duración p95',
      summary.cimasim.p95_duration_seconds === null
        ? 'Sin datos'
        : metric(summary.cimasim.p95_duration_seconds, ' s'),
    ],
    ['Uptime', metric(summary.host.uptime_seconds / 3600, ' h')],
    ['Backend', summary.cimasim.backend_up ? 'Operativo' : 'No disponible'],
    ['Spool', summary.cimasim.spool_ready ? 'Operativo' : 'No disponible'],
  ]

  return (
    <section className="monitoring-page">
      <PageHeader
        title="Monitorización"
        subtitle="Estado agregado del host y de CimaSim"
        actions={
          <button type="button" className="monitoring-refresh" onClick={() => void refresh()}>
            <RefreshCw size={16} aria-hidden="true" /> Actualizar
          </button>
        }
      />
      <div className={`monitoring-overall monitoring-overall--${summary.status}`}>
        {summary.status === 'healthy' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        Estado general: {statusLabel}
      </div>
      <div className="monitoring-grid">
        {cards.map(([label, value]) => (
          <div className="monitoring-metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="monitoring-chart-band">
        <div className="monitoring-chart-header">
          <h2>Historial</h2>
          <div className="monitoring-range" role="group" aria-label="Rango del historial">
            {ranges.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={range === item}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <ReactEChartsCore echarts={echarts} option={chartOption} style={{ height: 360 }} notMerge />
      </div>
      <section className="monitoring-alerts">
        <h2>Alertas activas</h2>
        {summary.alerts.length === 0 ? (
          <p>No hay alertas activas.</p>
        ) : (
          <ul>
            {summary.alerts.map((alert) => (
              <li key={`${alert.name}-${alert.state}`}>
                <strong>{alert.name}</strong> · {alert.severity} · {alert.state}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
