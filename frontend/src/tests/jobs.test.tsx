import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobsPage from '../pages/JobsPage'

describe('JobsPage', () => {
  it('shows an empty real-jobs state without mock jobs', async () => {
    render(
      <MemoryRouter>
        <JobsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/sin trabajos reales/i)).toBeInTheDocument()
    expect(screen.queryByText('Barrido CLOAD/RLOAD')).not.toBeInTheDocument()
    expect(screen.queryByText(/simular finalización/i)).not.toBeInTheDocument()
  })
})
