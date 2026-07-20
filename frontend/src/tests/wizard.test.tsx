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
        job_submission: submissionAvailable ? 'available' : 'temporarily_unavailable',
      },
    },
    refreshHealth,
  }),
}))

const job = {
  job_id: `job_${'a'.repeat(32)}`,
  name: 'Prueba RC fija',
  template_id: 'rc_lowpass_fixed_v1',
  simulator: 'xyce',
  status: 'queued',
  created_at: '2026-07-20T12:00:00Z',
  updated_at: '2026-07-20T12:00:00Z',
  summary: null,
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

describe('fixed RC simulation', () => {
  beforeEach(() => {
    submissionAvailable = true
    refreshHealth.mockReset()
  })

  it('starts with the fixed read-only RC configuration', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /prueba RC fija/i })).toBeInTheDocument()
    expect(screen.getByText('rc_lowpass_fixed_v1')).toBeInTheDocument()
    expect(screen.getByText('1 kΩ')).toBeInTheDocument()
    expect(screen.queryByLabelText(/netlist/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/barrido/i)).not.toBeInTheDocument()
  })

  it('switches to bounded configurable fields and shows normalized values', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: /RC configurable/i }))
    expect(screen.getByRole('heading', { name: 'RC configurable' })).toBeInTheDocument()
    expect(screen.getByLabelText('Resistencia')).toHaveValue(1000)
    expect(screen.getByLabelText('Unidad de Capacitancia')).toHaveValue('µF')
    expect(screen.getByText('1.000000e-6 F')).toBeInTheDocument()
    expect(screen.getByText('5.000000')).toBeInTheDocument()
    expect(screen.queryByLabelText(/netlist/i)).not.toBeInTheDocument()
  })

  it('sends an exact numeric SI payload for the configurable template', async () => {
    const user = userEvent.setup()
    const parameterizedJob = {
      ...job,
      name: 'RC personalizada',
      template_id: 'rc_lowpass_param_v1',
      parameters: {
        resistance_ohms: 1000,
        capacitance_farads: 1e-6,
        input_voltage_volts: 1,
        duration_seconds: 0.005,
      },
      derived: { time_constant_seconds: 0.001 },
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(parameterizedJob), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    renderPage()
    await user.click(screen.getByRole('tab', { name: /RC configurable/i }))
    await user.click(screen.getByRole('button', { name: /ejecutar RC configurable/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))
    expect(payload).toEqual({
      name: 'RC personalizada',
      template_id: 'rc_lowpass_param_v1',
      parameters: {
        resistance_ohms: 1000,
        capacitance_farads: 1e-6,
        input_voltage_volts: 1,
        duration_seconds: 0.005,
      },
    })
    expect(Object.values(payload.parameters).every((value) => typeof value === 'number')).toBe(true)
    expect(JSON.stringify(payload)).not.toMatch(/"1k"|"1u"|"5ms"|µ|Ω/)
  })

  it('disables submission when job submission is unavailable', () => {
    submissionAvailable = false
    renderPage()
    expect(screen.getByRole('button', { name: /ejecutar prueba RC/i })).toBeDisabled()
    expect(screen.getByText(/no está disponible temporalmente/i)).toBeInTheDocument()
  })

  it('creates the fixed job and navigates without waiting for execution', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(job), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    renderPage()
    await user.click(screen.getByRole('button', { name: /ejecutar prueba RC/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.body).toBe(
      JSON.stringify({ name: 'Prueba RC fija', template_id: 'rc_lowpass_fixed_v1' }),
    )
  })

  it('prevents a double click from sending two POST requests', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(job), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    renderPage()
    await user.dblClick(screen.getByRole('button', { name: /ejecutar prueba RC/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('reuses the same idempotency key after an unconfirmed request', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(job), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    renderPage()
    await user.click(screen.getByRole('button', { name: /ejecutar prueba RC/i }))
    expect(await screen.findByText(/no fue posible confirmar/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reintentar envío/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()
    const firstHeaders = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    const secondHeaders = vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string, string>
    expect(firstHeaders['Idempotency-Key']).toBe(secondHeaders['Idempotency-Key'])
  })
})
