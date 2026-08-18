import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { JobsProvider } from '../hooks/JobsProvider'
import JobDetailPage from '../pages/JobDetailPage'
import JobsPage from '../pages/JobsPage'
import ResultsIndexPage from '../pages/ResultsIndexPage'

vi.mock('../components/charts/ResultChart', () => ({
  ResultChart: () => <div aria-label="Gráfica de voltaje con las series V(in) y V(out)" />,
}))

const JOB_ID = `job_${'5'.repeat(32)}`
const artifact = { filename: 'waveform.csv', content_type: 'text/csv', size_bytes: 128 }
const succeededJob = {
  job_id: JOB_ID,
  name: 'RC autenticada',
  template_id: 'rc_lowpass_fixed_v1',
  simulator: 'xyce',
  status: 'succeeded',
  created_at: '2026-07-20T12:00:00Z',
  updated_at: '2026-07-20T12:00:01Z',
  summary: {
    status: 'succeeded',
    simulator: 'xyce',
    template: 'rc_lowpass_fixed_v1',
    samples: 2013,
    duration_seconds: 0.005,
    elapsed_seconds: 0.31,
    error: null,
    artifacts: [artifact],
  },
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fixed jobs UI', () => {
  it('shows real jobs and no unsupported actions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ jobs: [succeededJob] }))
    render(
      <MemoryRouter>
        <JobsProvider>
          <JobsPage />
        </JobsProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByText('RC autenticada')).toBeInTheDocument()
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('2013')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /cancelar|borrar|reintentar/i }),
    ).not.toBeInTheDocument()
  })

  it('lists only completed jobs that have waveform.csv as results', async () => {
    const queued = {
      ...succeededJob,
      job_id: `job_${'6'.repeat(32)}`,
      status: 'queued',
      summary: null,
    }
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ jobs: [queued, succeededJob] }))
    render(
      <MemoryRouter>
        <JobsProvider>
          <ResultsIndexPage />
        </JobsProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByText('RC autenticada')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('labels fixed and configurable templates in the jobs list', async () => {
    const parameterized = {
      ...succeededJob,
      job_id: `job_${'8'.repeat(32)}`,
      name: 'RC configurable',
      template_id: 'rc_lowpass_param_v1',
      parameters: {
        resistance_ohms: 1000,
        capacitance_farads: 1e-6,
        input_voltage_volts: 1,
        duration_seconds: 0.005,
      },
      derived: { time_constant_seconds: 0.001 },
      summary: { ...succeededJob.summary, template: 'rc_lowpass_param_v1' },
    }
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ jobs: [parameterized, succeededJob] }))
    render(
      <MemoryRouter>
        <JobsProvider>
          <JobsPage />
        </JobsProvider>
      </MemoryRouter>,
    )
    expect((await screen.findAllByText('Simulación RC heredada')).length).toBeGreaterThan(1)
    expect(screen.getByText('rc_lowpass_param_v1')).toBeInTheDocument()
  })

  it('shows the succeeded summary, validated graph, metrics, and same-origin download', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(succeededJob))
      .mockResolvedValueOnce(
        new Response('time_seconds,input_volts,output_volts\n0,0,0\n0.005,1,0.993262\n', {
          status: 200,
          headers: { 'content-type': 'text/csv' },
        }),
      )
    render(
      <MemoryRouter initialEntries={[`/jobs/${JOB_ID}`]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('RC autenticada')).toBeInTheDocument()
    expect(await screen.findByLabelText(/series V\(in\) y V\(out\)/i)).toBeInTheDocument()
    expect(screen.getByText('2', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getAllByText('5.000 ms').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /descargar waveform.csv/i })).toHaveAttribute(
      'href',
      `/api/jobs/${JOB_ID}/artifacts/waveform.csv`,
    )
  })

  it('lists both templates and displays read-only configurable parameters', async () => {
    const parameterized = {
      ...succeededJob,
      job_id: `job_${'7'.repeat(32)}`,
      name: 'RC configurable real',
      template_id: 'rc_lowpass_param_v1',
      parameters: {
        resistance_ohms: 10_000,
        capacitance_farads: 1e-7,
        input_voltage_volts: 3.3,
        duration_seconds: 0.005,
      },
      derived: { time_constant_seconds: 0.001 },
      summary: {
        ...succeededJob.summary,
        template: 'rc_lowpass_param_v1',
        parameters: {
          resistance_ohms: 10_000,
          capacitance_farads: 1e-7,
          input_voltage_volts: 3.3,
          duration_seconds: 0.005,
        },
        derived: { time_constant_seconds: 0.001 },
      },
    }
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(parameterized))
      .mockResolvedValueOnce(
        new Response('time_seconds,input_volts,output_volts\n0,0,0\n0.005,3.3,3.2777\n', {
          status: 200,
          headers: { 'content-type': 'text/csv' },
        }),
      )
    render(
      <MemoryRouter initialEntries={[`/jobs/${parameterized.job_id}`]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('RC configurable real')).toBeInTheDocument()
    expect(screen.getByText('Parámetros normalizados')).toBeInTheDocument()
    expect(screen.getByText('1.000000e+4 Ω')).toBeInTheDocument()
    expect(screen.getByText('3.300000e+0 V')).toBeInTheDocument()
    expect(screen.getByText('rc_lowpass_param_v1')).toBeInTheDocument()
    expect(await screen.findByLabelText(/series V\(in\) y V\(out\)/i)).toBeInTheDocument()
  })

  it('renders generic custom columns and the results.csv download', async () => {
    const custom = {
      ...succeededJob,
      job_id: `job_${'9'.repeat(32)}`,
      name: 'Transient custom',
      template_id: 'custom_xyce_netlist_v1',
      summary: {
        ...succeededJob.summary,
        template: 'custom_xyce_netlist_v1',
        analysis: 'tran',
        columns: ['TIME', 'V(OUT)', 'I(R1)'],
        artifacts: [{ filename: 'results.csv', content_type: 'text/csv', size_bytes: 96 }],
      },
    }
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(custom))
      .mockResolvedValueOnce(
        new Response('TIME,V(OUT),I(R1)\n0,0,0\n0.001,0.5,0.0005\n', {
          status: 200,
          headers: { 'content-type': 'text/csv' },
        }),
      )
    render(
      <MemoryRouter initialEntries={[`/jobs/${custom.job_id}`]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Transient custom')).toBeInTheDocument()
    expect(await screen.findByText(/2 filas.*3 columnas/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /descargar results.csv/i })).toHaveAttribute(
      'href',
      `/api/jobs/${custom.job_id}/artifacts/results.csv`,
    )
    expect(screen.getByRole('combobox', { name: /eje x/i })).toHaveValue('0')
    expect(screen.getAllByText('V(OUT)').length).toBeGreaterThan(1)
  })
})
