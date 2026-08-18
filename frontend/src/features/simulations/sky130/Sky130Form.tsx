import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Play, RefreshCw, ShieldCheck } from 'lucide-react'
import { ApiError } from '../../../api/errors'
import { createSky130Job, jobErrorMessage, preflightSky130Job } from '../../../api/jobsApi'
import {
  SKY130_TEMPLATE_ID,
  type Sky130JobCreateRequest,
  type NetlistPreflight,
} from '../../../api/jobTypes'
import { useSession } from '../../../session/useSession'
import {
  CURRENT_UNITS,
  SHORT_TIME_UNITS,
  TIME_UNITS,
  defaultSky130FormState,
  resolveSky130Form,
  type CurrentUnit,
  type ShortTimeUnit,
  type Sky130FormState,
  type TimeUnit,
} from './sky130Parameters'

interface PendingCreation {
  key: string
  request: Sky130JobCreateRequest
}

function nameError(name: string): string | null {
  if (!name.trim() || name.length > 120) return 'El nombre debe contener entre 1 y 120 caracteres.'
  return null
}

export function Sky130Form() {
  const navigate = useNavigate()
  const { health, refreshHealth } = useSession()
  const [name, setName] = useState('Oscilador SKY130 (bulk flotante)')
  const [form, setForm] = useState<Sky130FormState>(defaultSky130FormState())
  const [preflight, setPreflight] = useState<NetlistPreflight | null>(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<PendingCreation | null>(null)
  const busy = useRef(false)

  const available = health?.features.sky130_template === 'available'
  const { parameters, error: rangeError } = useMemo(() => resolveSky130Form(form), [form])
  const nameProblem = nameError(name)
  const validationError = nameProblem ?? rangeError

  const request = useMemo<Sky130JobCreateRequest | null>(() => {
    if (!parameters) return null
    return { name: name.trim(), template_id: SKY130_TEMPLATE_ID, sky130_parameters: parameters }
  }, [name, parameters])

  function update<K extends keyof Sky130FormState>(key: K, value: Sky130FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setPreflight(null)
    setError(null)
  }

  async function validate() {
    if (validationError || !request || validating) return
    setValidating(true)
    setError(null)
    try {
      setPreflight(await preflightSky130Job(request))
    } catch (caught) {
      setPreflight(null)
      setError(jobErrorMessage(caught))
    } finally {
      setValidating(false)
    }
  }

  async function execute() {
    if (busy.current || validationError || !request || !available || !preflight) return
    busy.current = true
    setSubmitting(true)
    setError(null)
    const action = pending.current ?? { key: crypto.randomUUID(), request }
    pending.current = action
    let navigated = false
    try {
      const { job } = await createSky130Job(action.request, action.key)
      pending.current = null
      navigated = true
      navigate(`/jobs/${job.job_id}`)
    } catch (caught) {
      setError(jobErrorMessage(caught))
      if (caught instanceof ApiError && !['network', 'timeout'].includes(caught.kind)) {
        pending.current = null
      }
    } finally {
      if (!navigated) {
        busy.current = false
        setSubmitting(false)
      }
    }
  }

  return (
    <div className="custom-netlist-layout">
      <section className="custom-netlist-editor" aria-labelledby="sky130-preview-heading">
        <div className="custom-netlist-heading">
          <h2 id="sky130-preview-heading">Netlist generado</h2>
          <span>Solo lectura · generado por el servidor</span>
        </div>
        <div className="custom-netlist-code">
          <pre aria-hidden="true">
            {Array.from(
              { length: (preflight?.netlist ?? '').split('\n').length },
              (_, index) => index + 1,
            ).join('\n')}
          </pre>
          <textarea
            aria-label="Netlist SKY130 generado"
            readOnly
            spellCheck={false}
            value={
              preflight?.netlist ??
              '* Pulsa "Validar" para generar el netlist con los parámetros actuales.'
            }
          />
        </div>
        <p className="fixed-job-boundary">
          Este netlist lo construye código confiable del servidor a partir de los
          parámetros. No admite <code>.lib</code>, <code>.include</code>, rutas ni
          expresiones arbitrarias.
        </p>
      </section>

      <section className="fixed-job-panel" aria-labelledby="sky130-submit-heading">
        <h2 id="sky130-submit-heading">Oscilador SKY130 (bulk flotante)</h2>

        <label className="fixed-job-field">
          <span>Nombre</span>
          <input
            maxLength={120}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setPreflight(null)
            }}
          />
        </label>

        <div className="fixed-job-field">
          <span>Device</span>
          <input value="sky130_fd_pr__nfet_g5v0d10v5" readOnly disabled />
        </div>
        <div className="fixed-job-field">
          <span>Corner</span>
          <input value="tt" readOnly disabled />
        </div>

        <div className="fixed-job-field-row">
          <label className="fixed-job-field">
            <span>L (µm)</span>
            <input
              type="number"
              step="any"
              value={form.lUm}
              onChange={(event) => update('lUm', event.target.value)}
            />
          </label>
          <label className="fixed-job-field">
            <span>W (µm)</span>
            <input
              type="number"
              step="any"
              value={form.wUm}
              onChange={(event) => update('wUm', event.target.value)}
            />
          </label>
          <label className="fixed-job-field">
            <span>nf</span>
            <input
              type="number"
              step={1}
              min={1}
              value={form.nf}
              onChange={(event) => update('nf', event.target.value)}
            />
          </label>
        </div>

        <label className="fixed-job-field">
          <span>IIN</span>
          <div className="fixed-job-field-row">
            <input
              type="number"
              step="any"
              value={form.iinMagnitude}
              onChange={(event) => update('iinMagnitude', event.target.value)}
            />
            <select
              value={form.iinUnit}
              onChange={(event) => update('iinUnit', event.target.value as CurrentUnit)}
            >
              {Object.keys(CURRENT_UNITS).map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="fixed-job-field-row">
          <label className="fixed-job-field">
            <span>RGATE (Ω)</span>
            <input
              type="number"
              step="any"
              value={form.rgateOhm}
              onChange={(event) => update('rgateOhm', event.target.value)}
            />
          </label>
          <label className="fixed-job-field">
            <span>RBULK (Ω)</span>
            <input
              type="number"
              step="any"
              value={form.rbulkOhm}
              onChange={(event) => update('rbulkOhm', event.target.value)}
            />
          </label>
        </div>

        <div className="fixed-job-field-row">
          <label className="fixed-job-field">
            <span>CPAR (F)</span>
            <input
              type="number"
              step="any"
              value={form.cparF}
              onChange={(event) => update('cparF', event.target.value)}
            />
          </label>
          <label className="fixed-job-field">
            <span>CGATE (F)</span>
            <input
              type="number"
              step="any"
              value={form.cgateF}
              onChange={(event) => update('cgateF', event.target.value)}
            />
          </label>
          <label className="fixed-job-field">
            <span>CBULK (F)</span>
            <input
              type="number"
              step="any"
              value={form.cbulkF}
              onChange={(event) => update('cbulkF', event.target.value)}
            />
          </label>
        </div>

        <label className="fixed-job-field">
          <span>Temperatura (°C)</span>
          <input
            type="number"
            step="any"
            min={-100}
            max={200}
            value={form.temperatureCelsius}
            onChange={(event) => update('temperatureCelsius', event.target.value)}
          />
        </label>

        <label className="fixed-job-field">
          <span>Tstop</span>
          <div className="fixed-job-field-row">
            <input
              type="number"
              step="any"
              value={form.tstopMagnitude}
              onChange={(event) => update('tstopMagnitude', event.target.value)}
            />
            <select
              value={form.tstopUnit}
              onChange={(event) => update('tstopUnit', event.target.value as TimeUnit)}
            >
              {Object.keys(TIME_UNITS).map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="fixed-job-field">
          <span>Output interval</span>
          <div className="fixed-job-field-row">
            <input
              type="number"
              step="any"
              value={form.outputIntervalMagnitude}
              onChange={(event) => update('outputIntervalMagnitude', event.target.value)}
            />
            <select
              value={form.outputIntervalUnit}
              onChange={(event) =>
                update('outputIntervalUnit', event.target.value as ShortTimeUnit)
              }
            >
              {Object.keys(SHORT_TIME_UNITS).map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </label>

        {validationError && (
          <p className="fixed-job-error" role="alert">
            {validationError}
          </p>
        )}
        {error && (
          <p className="fixed-job-inline-error" role="alert">
            {error}
          </p>
        )}
        {preflight && (
          <div className="custom-preflight" aria-label="Resumen de validación">
            <CheckCircle2 size={18} aria-hidden="true" />
            <strong>Parámetros válidos</strong>
            <dl>
              <dt>Análisis</dt>
              <dd>{preflight.analysis.toUpperCase()}</dd>
              <dt>Dispositivos</dt>
              <dd>{preflight.devices}</dd>
              <dt>Outputs</dt>
              <dd>{preflight.outputs.join(', ')}</dd>
              <dt>Temperatura</dt>
              <dd>{preflight.temperature_celsius} C</dd>
            </dl>
          </div>
        )}

        <div className="fixed-job-actions">
          <button
            type="button"
            className="fixed-job-secondary-button"
            disabled={Boolean(validationError) || !request || validating}
            onClick={() => void validate()}
          >
            {validating ? <RefreshCw size={16} className="spin" /> : <ShieldCheck size={16} />}{' '}
            Validar
          </button>
          <button
            type="button"
            className="fixed-job-primary-button"
            disabled={!available || !preflight || submitting}
            onClick={() => void execute()}
          >
            {submitting ? <RefreshCw size={16} className="spin" /> : <Play size={16} />} Ejecutar
          </button>
        </div>
        {!available && (
          <div className="fixed-job-availability">
            <span className="status-dot" />
            La plantilla SKY130 no está habilitada.
            <button type="button" onClick={() => void refreshHealth()}>
              Actualizar
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
