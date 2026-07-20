import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResultDetailPage from '../pages/ResultDetailPage'

function renderResult(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/results/${id}`]}>
      <Routes>
        <Route path="/results/:simulationId" element={<ResultDetailPage />} />
        <Route path="/jobs/:jobId" element={<div>Detalle del trabajo</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResultDetailPage', () => {
  it('redirects legacy result links to the real job detail', async () => {
    renderResult('result-cmos-amp')
    expect(await screen.findByText(/detalle del trabajo/i)).toBeInTheDocument()
  })

  it('does not render a separate fake result entity', async () => {
    renderResult('does-not-exist')
    expect(await screen.findByText(/detalle del trabajo/i)).toBeInTheDocument()
    expect(screen.queryByText(/respuesta en frecuencia/i)).not.toBeInTheDocument()
  })
})
