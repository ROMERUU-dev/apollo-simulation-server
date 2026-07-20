import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../app/App'

vi.mock('echarts-for-react/lib/core', () => ({
  default: ({ option }: { option: unknown }) => (
    <div data-testid="monitoring-chart">{JSON.stringify(option)}</div>
  ),
}))

const summary = {
  generated_at: '2026-07-20T00:00:00Z',
  status: 'healthy',
  host: {
    cpu_percent: 12,
    load_1: 0.5,
    memory_percent: 35,
    root_disk_percent: 42,
    data_disk_percent: 51,
    temperature_celsius: 49,
    uptime_seconds: 3600,
  },
  cimasim: {
    backend_up: true,
    spool_ready: true,
    queued: 0,
    running: 0,
    completed_total: 5,
    failed_total: 0,
    p95_duration_seconds: 0.4,
  },
  alerts: [],
}

const history = {
  generated_at: '2026-07-20T00:00:00Z',
  range: '1h',
  series: [{ key: 'cpu_percent', points: [{ timestamp: '2026-07-20T00:00:00Z', value: 12 }] }],
}

function monitoringFetch(status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/admin/monitoring/summary') {
      return Promise.resolve(
        new Response(JSON.stringify(status === 200 ? summary : { error: {} }), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }
    if (url.startsWith('/api/admin/monitoring/history')) {
      return Promise.resolve(
        new Response(JSON.stringify(history), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }
    if (url === '/api/me')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            user_id: 'x',
            email: 'u@example.test',
            roles: ['user'],
            is_admin: false,
            limits: {},
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
    if (url === '/api/health')
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'ok', service: 'cimasim', features: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    if (url === '/api/jobs')
      return Promise.resolve(
        new Response(JSON.stringify({ jobs: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    return Promise.resolve(
      new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }),
    )
  })
}

describe('admin monitoring', () => {
  it('shows navigation only after an authorized summary response', async () => {
    monitoringFetch()
    render(<App />)
    expect(await screen.findByRole('link', { name: 'Monitorización' })).toBeInTheDocument()
  })

  it('keeps navigation hidden for normal users', async () => {
    monitoringFetch(403)
    render(<App />)
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/monitoring/summary',
        expect.anything(),
      ),
    )
    expect(screen.queryByRole('link', { name: 'Monitorización' })).not.toBeInTheDocument()
  })

  it('renders real summary and history without mock metrics', async () => {
    const user = userEvent.setup()
    monitoringFetch()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Monitorización' }))
    expect(await screen.findByRole('heading', { name: 'Monitorización' })).toBeInTheDocument()
    expect(screen.getByText('12%')).toBeInTheDocument()
    expect(screen.getByText('No hay alertas activas.')).toBeInTheDocument()
  })
})
