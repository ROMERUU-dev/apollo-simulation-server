import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResultDetailPage from '../pages/ResultDetailPage'

function renderResult(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/results/${id}`]}>
      <Routes>
        <Route path="/results/:simulationId" element={<ResultDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResultDetailPage', () => {
  it('shows an empty result state without mock data', async () => {
    renderResult('result-cmos-amp')

    expect(await screen.findByText(/resultado no encontrado/i)).toBeInTheDocument()
    expect(screen.queryByText(/Respuesta en frecuencia/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/cmos_two_stage/i)).not.toBeInTheDocument()
  })

  it('shows an error state for an unknown result id', async () => {
    renderResult('does-not-exist')
    expect(await screen.findByText(/resultado no encontrado/i)).toBeInTheDocument()
  })
})
