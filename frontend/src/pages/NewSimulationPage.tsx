import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircuitBoard, Play, RefreshCw } from 'lucide-react'
import { ApiError } from '../api/errors'
import { createFixedRcJob, jobErrorMessage } from '../api/jobsApi'
import { FIXED_RC_TEMPLATE_ID } from '../api/jobTypes'
import { PageHeader } from '../components/layout/PageHeader'
import { useSession } from '../session/useSession'

const DEFAULT_JOB_NAME = 'Prueba RC fija'

interface PendingCreation {
  key: string
  name: string
}

function validateName(value: string): string | null {
  if (value.length > 120) return 'El nombre no puede exceder 120 caracteres.'
  if (
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    return 'El nombre no puede contener caracteres de control.'
  }
  if (!value.trim()) return 'Escribe un nombre para el trabajo.'
  return null
}

export default function NewSimulationPage() {
  const navigate = useNavigate()
  const { health, refreshHealth } = useSession()
  const [name, setName] = useState(DEFAULT_JOB_NAME)
  const [submitting, setSubmitting] = useState(false)
  const [retryingUnconfirmed, setRetryingUnconfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef<PendingCreation | null>(null)
  const submittingRef = useRef(false)
  const nameError = validateName(name)
  const available = health?.features.job_submission === 'available'

  async function submit() {
    if (submittingRef.current || nameError || !available) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    const pending = pendingRef.current ?? { key: crypto.randomUUID(), name: name.trim() }
    pendingRef.current = pending
    let navigated = false
    try {
      const { job } = await createFixedRcJob(pending.name, pending.key)
      pendingRef.current = null
      setRetryingUnconfirmed(false)
      navigated = true
      navigate(`/jobs/${job.job_id}`)
    } catch (requestError) {
      setError(jobErrorMessage(requestError))
      if (
        requestError instanceof ApiError &&
        requestError.kind !== 'network' &&
        requestError.kind !== 'timeout'
      ) {
        pendingRef.current = null
        setRetryingUnconfirmed(false)
      } else {
        setRetryingUnconfirmed(true)
      }
    } finally {
      if (!navigated) {
        submittingRef.current = false
        setSubmitting(false)
      }
    }
  }
  return (
    <div>
      <PageHeader
        title="Prueba RC de paso bajo"
        subtitle="Simulación transitoria fija ejecutada con Xyce."
      />

      <div className="fixed-job-layout">
        <section className="fixed-job-panel" aria-labelledby="fixed-circuit-heading">
          <div className="fixed-job-panel-heading">
            <CircuitBoard size={20} aria-hidden="true" />
            <h2 id="fixed-circuit-heading">Configuración autorizada</h2>
          </div>
          <dl className="fixed-job-definition-list">
            <div>
              <dt>Entrada</dt>
              <dd>Pulso de 0 a 1 V</dd>
            </div>
            <div>
              <dt>Resistencia</dt>
              <dd>1 kΩ</dd>
            </div>
            <div>
              <dt>Capacitor</dt>
              <dd>1 µF</dd>
            </div>
            <div>
              <dt>Duración simulada</dt>
              <dd>5 ms</dd>
            </div>
            <div>
              <dt>Plantilla</dt>
              <dd>
                <code>{FIXED_RC_TEMPLATE_ID}</code>
              </dd>
            </div>
            <div>
              <dt>Simulador</dt>
              <dd>Xyce</dd>
            </div>
          </dl>
          <p className="fixed-job-boundary">Por ahora solo está disponible la prueba RC fija.</p>
        </section>

        <section className="fixed-job-panel" aria-labelledby="submit-job-heading">
          <h2 id="submit-job-heading">Ejecutar simulación</h2>
          <label className="fixed-job-field">
            <span>Nombre del trabajo</span>
            <input
              value={name}
              maxLength={120}
              disabled={submitting || retryingUnconfirmed}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'job-name-error' : undefined}
            />
          </label>
          {nameError && (
            <p id="job-name-error" className="fixed-job-error">
              {nameError}
            </p>
          )}

          <div className={`fixed-job-availability ${available ? 'is-available' : ''}`}>
            <span className="status-dot" aria-hidden="true" />
            {available
              ? 'El motor está disponible para recibir trabajos.'
              : 'El motor de simulación no está disponible temporalmente.'}
          </div>

          {error && (
            <div className="fixed-job-inline-error" role="alert">
              <p>{error}</p>
              {error.includes('sesión') && (
                <button type="button" onClick={() => window.location.reload()}>
                  Recargar página
                </button>
              )}
            </div>
          )}

          <div className="fixed-job-actions">
            <button
              type="button"
              className="fixed-job-primary-button"
              disabled={!available || Boolean(nameError) || submitting}
              onClick={() => void submit()}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="spin" aria-hidden="true" /> Enviando…
                </>
              ) : retryingUnconfirmed ? (
                <>
                  <RefreshCw size={16} aria-hidden="true" /> Reintentar envío
                </>
              ) : (
                <>
                  <Play size={16} aria-hidden="true" /> Ejecutar prueba RC
                </>
              )}
            </button>
            {!available && (
              <button
                type="button"
                className="fixed-job-secondary-button"
                onClick={() => void refreshHealth()}
              >
                <RefreshCw size={15} aria-hidden="true" /> Actualizar estado
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
