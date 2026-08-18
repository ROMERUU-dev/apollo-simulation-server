import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NewSimulationPage from '../pages/NewSimulationPage'

const refreshHealth = vi.fn()
let sky130Available = true
let customAvailable = true

vi.mock('../session/useSession', () => ({
  useSession: () => ({
    health: {
      status: 'ok',
      features: {
        identity: 'available',
        custom_netlists: customAvailable ? 'available' : 'temporarily_unavailable',
        sky130_template: sky130Available ? 'available' : 'temporarily_unavailable',
      },
    },
    refreshHealth,
  }),
}))

const GOLDEN_NETLIST = `* CimaSim sky130_floating_bulk_v1 - server-generated, do not edit
.lib "/pdks/sky130A/libs.tech/ngspice/sky130.lib.spice" tt

IIN   0    vout  DC 1e-07
CPAR  vout 0     1e-12

XM1   vout vg 0 vb sky130_fd_pr__nfet_g5v0d10v5
+ L=0.5 W=1 nf=1
+ ad={int((nf+1)/2) * W/nf * 0.29}
+ as={int((nf+2)/2) * W/nf * 0.29}

RGATE vg 0 1e+14
CGATE vg 0 1e-15
RBULK vb 0 1e+14
CBULK vb 0 1e-14

.OPTIONS DEVICE TEMP=27
.OPTIONS OUTPUT INITIAL_INTERVAL=5e-08
.TRAN 5e-08 0.001 UIC
.PRINT TRAN FORMAT=CSV FILE=/output/results.csv V(vout) V(vb) V(vg)
.END
`

const preflight = {
  valid: true,
  analysis: 'tran',
  devices: 7,
  nodes: 4,
  models: 0,
  subcircuits: 0,
  outputs: ['V(vout)', 'V(vb)', 'V(vg)'],
  temperature_celsius: 27,
  sandbox_ready: true,
  netlist: GOLDEN_NETLIST,
}

const job = {
  job_id: `job_${'b'.repeat(32)}`,
  name: 'Oscilador SKY130 (bulk flotante)',
  template_id: 'sky130_floating_bulk_v1',
  simulator: 'xyce',
  status: 'queued',
  created_at: '2026-08-18T12:00:00Z',
  updated_at: '2026-08-18T12:00:00Z',
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

async function selectSky130Mode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: /oscilador sky130/i }))
}

async function validate(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(preflight))
  await user.click(screen.getByRole('button', { name: /validar/i }))
  expect(await screen.findByText('Parámetros válidos')).toBeInTheDocument()
}

function postCalls() {
  return vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === '/api/jobs')
}

function preflightCalls() {
  return vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === '/api/jobs/preflight')
}

describe('SKY130 oscillator simulation mode', () => {
  beforeEach(() => {
    sky130Available = true
    customAvailable = true
    refreshHealth.mockReset()
  })

  it('defaults to the custom netlist mode without any selection', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /netlist personalizada/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /netlist xyce personalizada/i })).toBeChecked()
  })

  it('switches to the SKY130 form and shows the fixed device and corner', async () => {
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    expect(screen.getByRole('heading', { level: 1, name: /oscilador sky130/i })).toBeInTheDocument()
    const device = screen.getByDisplayValue('sky130_fd_pr__nfet_g5v0d10v5')
    expect(device).toBeDisabled()
    const corner = screen.getByDisplayValue('tt')
    expect(corner).toBeDisabled()
  })

  it('populates the exact baseline defaults', async () => {
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    expect(screen.getByLabelText('L (µm)')).toHaveValue(0.5)
    expect(screen.getByLabelText('W (µm)')).toHaveValue(1)
    expect(screen.getByLabelText('nf')).toHaveValue(1)
    expect(screen.getByLabelText('RGATE (Ω)')).toHaveValue(1e14)
    expect(screen.getByLabelText('RBULK (Ω)')).toHaveValue(1e14)
    expect(screen.getByLabelText('CPAR (F)')).toHaveValue(1e-12)
    expect(screen.getByLabelText('CGATE (F)')).toHaveValue(1e-15)
    expect(screen.getByLabelText('CBULK (F)')).toHaveValue(10e-15)
    expect(screen.getByLabelText('Temperatura (°C)')).toHaveValue(27)
  })

  it('lets the user edit a parameter comfortably with unit-aware inputs', async () => {
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    const iin = screen.getByLabelText('IIN')
    const iinInput = within(iin.closest('label') as HTMLElement).getByRole('spinbutton')
    await user.clear(iinInput)
    await user.type(iinInput, '300')
    expect(iinInput).toHaveValue(300)
  })

  it('rejects out-of-range parameters before hitting the network', async () => {
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    const wInput = screen.getByLabelText('W (µm)')
    await user.clear(wInput)
    await user.type(wInput, '500')
    expect(await screen.findByRole('alert')).toHaveTextContent(/fuera del rango/i)
    expect(screen.getByRole('button', { name: /validar/i })).toBeDisabled()
  })

  it('sends a structured request with no netlist, path or directive', async () => {
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    await validate(user)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(job, 201))
    await user.click(screen.getByRole('button', { name: /^ejecutar$/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()

    const [, init] = postCalls()[0]
    const payload = JSON.parse(String(init?.body))
    expect(payload).toMatchObject({ template_id: 'sky130_floating_bulk_v1' })
    expect(payload).not.toHaveProperty('netlist')
    expect(payload).not.toHaveProperty('requested_outputs')
    expect(payload.sky130_parameters).toMatchObject({
      device: 'sky130_fd_pr__nfet_g5v0d10v5',
      corner: 'tt',
      l_um: 0.5,
      w_um: 1,
      nf: 1,
      iin_a: 100e-9,
      rgate_ohm: 1e14,
      rbulk_ohm: 1e14,
      cpar_f: 1e-12,
      cgate_f: 1e-15,
      cbulk_f: 10e-15,
      temperature_celsius: 27,
      tstop_seconds: 1e-3,
      output_interval_seconds: 50e-9,
    })
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toMatch(/\.lib|\.include|\/home\/|\/pdks\//i)
  })

  it('shows the server-generated netlist as read-only after validating', async () => {
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    await validate(user)
    const textarea = screen.getByLabelText('Netlist SKY130 generado') as HTMLTextAreaElement
    expect(textarea).toHaveAttribute('readonly')
    expect(textarea.value).toBe(GOLDEN_NETLIST)
    expect(preflightCalls()).toHaveLength(1)
  })

  it('shows a placeholder before validating and never lets the user type into the preview', async () => {
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    const textarea = screen.getByLabelText('Netlist SKY130 generado') as HTMLTextAreaElement
    expect(textarea).toHaveAttribute('readonly')
    expect(textarea.value).toMatch(/pulsa "validar"/i)
  })

  it('disables execution when the sky130 template is unavailable', async () => {
    sky130Available = false
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    expect(screen.getByRole('button', { name: /^ejecutar$/i })).toBeDisabled()
    expect(screen.getByText(/plantilla sky130 no está habilitada/i)).toBeInTheDocument()
  })

  it('prevents a double click from sending two creation requests', async () => {
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    await validate(user)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(job, 201))
    await user.dblClick(screen.getByRole('button', { name: /^ejecutar$/i }))
    expect(await screen.findByText('Vista de trabajo')).toBeInTheDocument()
    expect(postCalls()).toHaveLength(1)
  })

  it('does not break the existing custom netlist mode when switching back', async () => {
    const user = userEvent.setup()
    renderPage()
    await selectSky130Mode(user)
    await user.click(screen.getByRole('radio', { name: /netlist xyce personalizada/i }))
    expect(screen.getByRole('heading', { name: /netlist personalizada/i })).toBeInTheDocument()
    expect((screen.getByLabelText('Netlist Xyce') as HTMLTextAreaElement).value).toContain('.TRAN')
  })
})
