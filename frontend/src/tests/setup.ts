import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

const identity = {
  user_id: 'cf-sub:test-user',
  email: 'usuario@uabc.edu.mx',
  name: null,
  roles: ['user'],
  is_admin: false,
  groups: [],
  limits: { active_jobs_per_user: 2 },
}

const health = {
  status: 'ok',
  service: 'cimasim',
  features: { identity: 'available', job_submission: 'not_available' },
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/me') {
      return Promise.resolve(
        new Response(JSON.stringify(identity), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        }),
      )
    }
    if (url === '/api/health') {
      return Promise.resolve(
        new Response(JSON.stringify(health), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        }),
      )
    }
    if (url === '/api/jobs') {
      return Promise.resolve(
        new Response(JSON.stringify({ jobs: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        }),
      )
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
