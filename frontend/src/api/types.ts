export interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    request_id?: string
  }
  request_id?: string
}

export interface CimaSimIdentity {
  user_id: string
  email: string
  name?: string | null
  roles: string[]
  is_admin: boolean
  groups?: string[]
  limits: Record<string, unknown>
}

export interface CimaSimHealth {
  status: 'ok' | string
  service: 'cimasim' | string
  features: {
    identity?: string
    job_submission?: string
    [key: string]: string | undefined
  }
}
