import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SessionProvider } from '../session/SessionContext'
import SettingsPage from '../pages/SettingsPage'
import HomePage from '../pages/HomePage'
import { JobsProvider } from '../hooks/JobsProvider'

function renderWithSession(element: ReactElement) {
  render(
    <MemoryRouter>
      <SessionProvider>
        <JobsProvider>{element}</JobsProvider>
      </SessionProvider>
    </MemoryRouter>,
  )
}

describe('live session UI', () => {
  it('shows email when name is null and reports unavailable job submission', async () => {
    renderWithSession(<SettingsPage />)
    expect(await screen.findByText('usuario@uabc.edu.mx')).toBeInTheDocument()
    expect(screen.getByText('Usuario')).toBeInTheDocument()
    expect(screen.getByText('Sesión protegida por Cloudflare Access')).toBeInTheDocument()
    expect(screen.getByText('Aún no habilitado')).toBeInTheDocument()
  })

  it('shows a real name when the backend provides one', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/me') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user_id: 'cf-sub:abc',
              email: 'user@uabc.edu.mx',
              name: 'Dra. Cima',
              roles: ['user'],
              is_admin: false,
              limits: {},
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: 'ok',
            service: 'cimasim',
            features: { identity: 'available', job_submission: 'not_available' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
    })
    renderWithSession(<SettingsPage />)
    expect(await screen.findByText('Dra. Cima')).toBeInTheDocument()
  })

  it('shows real API state and no mock telemetry on dashboard', async () => {
    renderWithSession(<HomePage />)
    expect(await screen.findByText('Conectado')).toBeInTheDocument()
    expect(screen.getByText('Trabajos activos').nextElementSibling).toHaveTextContent('0')
    expect(screen.getByText('Simulaciones completadas').nextElementSibling).toHaveTextContent('0')
    expect(screen.getByText(/solo está disponible la prueba RC fija/i)).toBeInTheDocument()
    expect(screen.queryByText(/HP Z8/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/CPU/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/apollo-hpz8/i)).not.toBeInTheDocument()
  })
})
