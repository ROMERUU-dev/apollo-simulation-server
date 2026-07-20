import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NewSimulationPage from '../pages/NewSimulationPage'

const refreshHealth = vi.fn()
let submissionAvailable = true

vi.mock('../session/useSession', () => ({
  useSession: () => ({
    health: {
      status: 'ok',
      features: {
        identity: 'available',
        custom_netlists: submissionAvailable ? 'available' : 'temporarily_unavailable',
      },
    },
    refreshHealth,
  }),
}))

const preflight = {
  valid: true,
  analysis: 'tran',
  devices: 3,
  nodes: 2,
  models: 0,
  subcircuits: 0,
  outputs: ['V(in)', 'V(out)'],
  sandbox_ready: true,
}

const job = {
  job_id: `job_${'a'.repeat(32)}`,
  name: 'Simulacion Xyce personalizada',
  template_id: 'custom_xyce_netlist_v1',
  simulator: 'xyce',
  status: 'queued',
  created_at: '2026-07-20T12:00:00Z',
  updated_at: '2026-07-20T12:00:00Z',
  summary: null,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/simulations/new']}>
      <Routes>
        <Route path="/simulations/new" element={<NewSimulationPage />} />
        <Route path="/jobs/:jobId" element={<div>Vista de trabajo</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function validate(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(preflight))
  await user.click(screen.getByRole('button', { name: /validar/i }))
  expect(await screen.findByText('Netlist válida')).toBeInTheDocument()
}

function postCalls() {
  return vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === '/api/jobs')
}

describe('custom Xyce simulation', () => {
  beforeEach(() => {
    submissionAvailable = true
    refreshHealth.mockReset()
  })

  it('shows only the custom netlist editor', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /netlist personalizada/i })).toBeInTheDocument()
    expect((screen.getByLabelText('Netlist Xyce') as HTMLTextAreaElement).value).toContain('.TRAN')
    expect(screen.queryByText('Prueba RC fija')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Resistencia')).not.toBeInTheDocument()
  })

  it('preflights the netlist and renders bounded counts', async () => {
    const user = userEvent.setup()
    renderPage()
    await validate(user)
    expect(screen.getByText('TRAN')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/jobs/preflight')
  })

  it('sends the exact custom payload without authentication headers', async () => {
    const user = userEvent.setup()
    renderPage()
    await validate(user)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(job, 201))
    await user.click(screen.getByRole('button', { name: /^ejecutar$/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()
    const [, init] = postCalls()[0]
    const payload = JSON.parse(String(init?.body))
    expect(payload).toMatchObject({
      template_id: 'custom_xyce_netlist_v1',
      requested_outputs: ['V(in)', 'V(out)'],
    })
    expect(payload.netlist).toContain('.TRAN 1u 5m')
    expect(init?.headers).not.toHaveProperty('Authorization')
    expect(init?.headers).not.toHaveProperty('Cf-Access-Jwt-Assertion')
  })

  it('disables execution when the custom runner is unavailable', async () => {
    submissionAvailable = false
    renderPage()
    expect(screen.getByRole('button', { name: /^ejecutar$/i })).toBeDisabled()
    expect(screen.getByText(/runner rootless no está habilitado/i)).toBeInTheDocument()
  })

  it('validates, creates, and navigates without waiting for execution', async () => {
    const user = userEvent.setup()
    renderPage()
    await validate(user)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(job, 201))
    await user.click(screen.getByRole('button', { name: /^ejecutar$/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()
    expect(postCalls()).toHaveLength(1)
  })

  it('prevents a double click from sending two creation requests', async () => {
    const user = userEvent.setup()
    renderPage()
    await validate(user)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(job, 201))
    await user.dblClick(screen.getByRole('button', { name: /^ejecutar$/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()
    expect(postCalls()).toHaveLength(1)
  })

  it('reuses the same idempotency key after an unconfirmed request', async () => {
    const user = userEvent.setup()
    renderPage()
    await validate(user)
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(jsonResponse(job, 200))

    await user.click(screen.getByRole('button', { name: /^ejecutar$/i }))
    expect(await screen.findByText(/no fue posible confirmar/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^ejecutar$/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()

    const calls = postCalls()
    const firstHeaders = calls[0][1]?.headers as Record<string, string>
    const secondHeaders = calls[1][1]?.headers as Record<string, string>
    expect(firstHeaders['Idempotency-Key']).toBe(secondHeaders['Idempotency-Key'])
  })
})
