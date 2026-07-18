import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProjectsPage from '../pages/ProjectsPage'

describe('ProjectsPage', () => {
  it('shows an empty real-project state and disables creation', async () => {
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/todavía no tienes proyectos reales/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nuevo proyecto/i })).toBeDisabled()
    expect(screen.queryByText('Oscilador térmico MOSFET')).not.toBeInTheDocument()
  })
})
