import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircuitBoard, Play, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { ApiError } from '../api/errors'
import { createRcJob, jobErrorMessage } from '../api/jobsApi'
import { FIXED_RC_TEMPLATE_ID, PARAM_RC_TEMPLATE_ID, type JobCreateRequest } from '../api/jobTypes'
import {
  formatSi,
  validateRcParameterForm,
  type CapacitanceUnit,
  type DurationUnit,
  type RcParameterFormValues,
} from '../api/rcParameters'
import { PageHeader } from '../components/layout/PageHeader'
import { useSession } from '../session/useSession'

const DEFAULT_FIXED_NAME = 'Prueba RC fija'
const DEFAULT_PARAM_NAME = 'RC personalizada'
const DEFAULT_PARAMETERS: RcParameterFormValues = {
  resistance: '1000',
  capacitance: '1',
  capacitanceUnit: 'µF',
  inputVoltage: '1',
  duration: '5',
  durationUnit: 'ms',
}

type SimulationMode = 'fixed' | 'configurable'

interface PendingCreation {
  key: string
  request: JobCreateRequest
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
  const [mode, setMode] = useState<SimulationMode>('fixed')
  const [name, setName] = useState(DEFAULT_FIXED_NAME)
  const [form, setForm] = useState(DEFAULT_PARAMETERS)
  const [submitting, setSubmitting] = useState(false)
  const [retryingUnconfirmed, setRetryingUnconfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef<PendingCreation | null>(null)
  const submittingRef = useRef(false)
  const nameError = validateName(name)
  const parameterValidation = useMemo(() => validateRcParameterForm(form), [form])
  const available = health?.features.job_submission === 'available'
  const formError = mode === 'configurable' ? parameterValidation.error : null

  function selectMode(nextMode: SimulationMode) {
    if (submittingRef.current || retryingUnconfirmed) return
    setMode(nextMode)
    setName(nextMode === 'fixed' ? DEFAULT_FIXED_NAME : DEFAULT_PARAM_NAME)
    setError(null)
  }

  function updateForm<Key extends keyof RcParameterFormValues>(
    key: Key,
    value: RcParameterFormValues[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function currentRequest(): JobCreateRequest | null {
    if (mode === 'fixed') {
      return { name: name.trim(), template_id: FIXED_RC_TEMPLATE_ID }
    }
    if (!parameterValidation.parameters) return null
    return {
      name: name.trim(),
      template_id: PARAM_RC_TEMPLATE_ID,
      parameters: parameterValidation.parameters,
    }
  }

  async function submit() {
    const request = currentRequest()
    if (submittingRef.current || nameError || formError || !available || !request) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    const pending = pendingRef.current ?? { key: crypto.randomUUID(), request }
    pendingRef.current = pending
    let navigated = false
    try {
      const { job } = await createRcJob(pending.request, pending.key)
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
      <PageHeader title="Simulaciones RC" subtitle="Plantillas educativas ejecutadas con Xyce." />

      <div className="fixed-job-mode-switch" role="tablist" aria-label="Plantilla RC">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'fixed'}
          onClick={() => selectMode('fixed')}
        >
          <CircuitBoard size={16} aria-hidden="true" /> Prueba RC fija
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'configurable'}
          onClick={() => selectMode('configurable')}
        >
          <SlidersHorizontal size={16} aria-hidden="true" /> RC configurable
        </button>
      </div>

      <div className="fixed-job-layout">
        {mode === 'fixed' ? (
          <FixedConfiguration />
        ) : (
          <ParameterizedConfiguration
            form={form}
            onChange={updateForm}
            validation={parameterValidation}
          />
        )}

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
            />
          </label>
          {(nameError || formError) && (
            <p className="fixed-job-error" role="alert">
              {nameError ?? formError}
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
              disabled={!available || Boolean(nameError || formError) || submitting}
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
                  <Play size={16} aria-hidden="true" />{' '}
                  {mode === 'fixed' ? 'Ejecutar prueba RC' : 'Ejecutar RC configurable'}
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

function FixedConfiguration() {
  return (
    <section className="fixed-job-panel" aria-labelledby="fixed-circuit-heading">
      <div className="fixed-job-panel-heading">
        <CircuitBoard size={20} aria-hidden="true" />
        <h2 id="fixed-circuit-heading">Prueba RC fija</h2>
      </div>
      <dl className="fixed-job-definition-list">
        <Definition term="Entrada" value="Pulso de 0 a 1 V" />
        <Definition term="Resistencia" value="1 kΩ" />
        <Definition term="Capacitor" value="1 µF" />
        <Definition term="Duración simulada" value="5 ms" />
        <Definition term="Plantilla" value={FIXED_RC_TEMPLATE_ID} code />
        <Definition term="Simulador" value="Xyce" />
      </dl>
    </section>
  )
}

function ParameterizedConfiguration({
  form,
  onChange,
  validation,
}: {
  form: RcParameterFormValues
  onChange: <Key extends keyof RcParameterFormValues>(
    key: Key,
    value: RcParameterFormValues[Key],
  ) => void
  validation: ReturnType<typeof validateRcParameterForm>
}) {
  return (
    <section className="fixed-job-panel" aria-labelledby="param-circuit-heading">
      <div className="fixed-job-panel-heading">
        <SlidersHorizontal size={20} aria-hidden="true" />
        <h2 id="param-circuit-heading">RC configurable</h2>
      </div>
      <div className="fixed-job-parameter-grid">
        <NumericField
          label="Resistencia"
          value={form.resistance}
          unit="Ω"
          onChange={(value) => onChange('resistance', value)}
        />
        <NumericField
          label="Capacitancia"
          value={form.capacitance}
          unit={form.capacitanceUnit}
          units={['pF', 'nF', 'µF', 'mF']}
          onChange={(value) => onChange('capacitance', value)}
          onUnitChange={(value) => onChange('capacitanceUnit', value as CapacitanceUnit)}
        />
        <NumericField
          label="Voltaje de entrada"
          value={form.inputVoltage}
          unit="V"
          onChange={(value) => onChange('inputVoltage', value)}
        />
        <NumericField
          label="Duración simulada"
          value={form.duration}
          unit={form.durationUnit}
          units={['µs', 'ms', 's']}
          onChange={(value) => onChange('duration', value)}
          onUnitChange={(value) => onChange('durationUnit', value as DurationUnit)}
        />
      </div>
      {validation.parameters && (
        <dl className="fixed-job-definition-list fixed-job-normalized">
          <Definition
            term="R normalizada"
            value={formatSi(validation.parameters.resistance_ohms, 'Ω')}
          />
          <Definition
            term="C normalizada"
            value={formatSi(validation.parameters.capacitance_farads, 'F')}
          />
          <Definition term="Vin" value={formatSi(validation.parameters.input_voltage_volts, 'V')} />
          <Definition
            term="Duración"
            value={formatSi(validation.parameters.duration_seconds, 's')}
          />
          <Definition
            term="Constante τ"
            value={formatSi(validation.timeConstantSeconds ?? 0, 's')}
          />
          <Definition term="Duración / τ" value={(validation.durationTauRatio ?? 0).toFixed(6)} />
          <Definition term="Plantilla" value={PARAM_RC_TEMPLATE_ID} code />
        </dl>
      )}
      <p className="fixed-job-boundary">
        Plantilla educativa: solo acepta cuatro números SI dentro de límites estrictos.
      </p>
    </section>
  )
}

function NumericField({
  label,
  value,
  unit,
  units,
  onChange,
  onUnitChange,
}: {
  label: string
  value: string
  unit: string
  units?: readonly string[]
  onChange: (value: string) => void
  onUnitChange?: (value: string) => void
}) {
  return (
    <label className="fixed-job-field">
      <span>{label}</span>
      <div className="fixed-job-number-control">
        <input
          aria-label={label}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {units && onUnitChange ? (
          <select
            aria-label={`Unidad de ${label}`}
            value={unit}
            onChange={(event) => onUnitChange(event.target.value)}
          >
            {units.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        ) : (
          <span>{unit}</span>
        )}
      </div>
    </label>
  )
}

function Definition({
  term,
  value,
  code = false,
}: {
  term: string
  value: string
  code?: boolean
}) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{code ? <code>{value}</code> : value}</dd>
    </div>
  )
}
