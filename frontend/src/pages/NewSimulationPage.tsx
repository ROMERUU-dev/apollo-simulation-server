import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Play, RefreshCw, ShieldCheck } from 'lucide-react'
import { ApiError } from '../api/errors'
import { createCustomJob, jobErrorMessage, preflightCustomJob } from '../api/jobsApi'
import {
  CUSTOM_XYCE_TEMPLATE_ID,
  type CustomJobCreateRequest,
  type NetlistPreflight,
} from '../api/jobTypes'
import { PageHeader } from '../components/layout/PageHeader'
import { useSession } from '../session/useSession'

const DEFAULT_NETLIST = `* CimaSim custom Xyce example
V1 in 0 PULSE(0 1 0 1u 1u 1m 2m)
R1 in out 1k
C1 out 0 1u
.TRAN 1u 5m
.END
`

interface PendingCreation {
  key: string
  request: CustomJobCreateRequest
}

function localError(name: string, netlist: string, outputs: string[]): string | null {
  if (!name.trim() || name.length > 120) return 'El nombre debe contener entre 1 y 120 caracteres.'
  const bytes = new TextEncoder().encode(netlist).byteLength
  if (bytes === 0 || bytes > 64 * 1024) return 'La netlist debe ocupar como máximo 64 KiB.'
  const lines = netlist.replaceAll('\r\n', '\n').split('\n')
  if (lines.length > 2000 || lines.some((line) => line.length > 512)) {
    return 'La netlist excede los límites de líneas.'
  }
  if (netlist.includes('\0')) return 'La netlist contiene caracteres no permitidos.'
  if (outputs.length === 0 || outputs.length > 64) return 'Solicita entre 1 y 64 salidas.'
  return null
}

export default function NewSimulationPage() {
  const navigate = useNavigate()
  const { health, refreshHealth } = useSession()
  const [name, setName] = useState('Simulación Xyce personalizada')
  const [netlist, setNetlist] = useState(DEFAULT_NETLIST)
  const [outputsText, setOutputsText] = useState('V(in), V(out)')
  const [preflight, setPreflight] = useState<NetlistPreflight | null>(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<PendingCreation | null>(null)
  const busy = useRef(false)
  const outputs = useMemo(
    () =>
      outputsText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [outputsText],
  )
  const validationError = localError(name, netlist, outputs)
  const available = health?.features.custom_netlists === 'available'
  const lineCount = netlist.replaceAll('\r\n', '\n').split('\n').length
  const bytes = new TextEncoder().encode(netlist).byteLength

  const request = useMemo<CustomJobCreateRequest>(
    () => ({
      name: name.trim(),
      template_id: CUSTOM_XYCE_TEMPLATE_ID,
      netlist,
      requested_outputs: outputs,
    }),
    [name, netlist, outputs],
  )

  function changeNetlist(value: string) {
    setNetlist(value)
    setPreflight(null)
    setError(null)
  }

  async function validate() {
    if (validationError || validating) return
    setValidating(true)
    setError(null)
    try {
      setPreflight(await preflightCustomJob(request))
    } catch (caught) {
      setPreflight(null)
      setError(jobErrorMessage(caught))
    } finally {
      setValidating(false)
    }
  }

  async function execute() {
    if (busy.current || validationError || !available || !preflight) return
    busy.current = true
    setSubmitting(true)
    setError(null)
    const action = pending.current ?? { key: crypto.randomUUID(), request }
    pending.current = action
    let navigated = false
    try {
      const { job } = await createCustomJob(action.request, action.key)
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
    <div>
      <PageHeader title="Netlist personalizada" subtitle="Subconjunto controlado de Xyce 7.10" />
      <div className="custom-netlist-layout">
        <section className="custom-netlist-editor" aria-labelledby="netlist-heading">
          <div className="custom-netlist-heading">
            <h2 id="netlist-heading">Netlist</h2>
            <span>
              {lineCount} líneas · {bytes.toLocaleString('es-MX')} bytes
            </span>
          </div>
          <div className="custom-netlist-code">
            <pre aria-hidden="true">
              {Array.from({ length: lineCount }, (_, index) => index + 1).join('\n')}
            </pre>
            <textarea
              aria-label="Netlist Xyce"
              value={netlist}
              spellCheck={false}
              onChange={(event) => changeNetlist(event.target.value)}
            />
          </div>
          <p className="fixed-job-boundary">
            Las netlists se ejecutan sin red y dentro de un entorno aislado.
          </p>
          <p>Compatible con el subconjunto Xyce indicado en la documentación.</p>
        </section>

        <section className="fixed-job-panel" aria-labelledby="custom-submit-heading">
          <h2 id="custom-submit-heading">Validar y ejecutar</h2>
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
          <label className="fixed-job-field">
            <span>Outputs solicitados</span>
            <input
              value={outputsText}
              onChange={(event) => {
                setOutputsText(event.target.value)
                setPreflight(null)
              }}
            />
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
              <strong>Netlist válida</strong>
              <dl>
                <dt>Análisis</dt>
                <dd>{preflight.analysis.toUpperCase()}</dd>
                <dt>Dispositivos</dt>
                <dd>{preflight.devices}</dd>
                <dt>Nodos</dt>
                <dd>{preflight.nodes}</dd>
                <dt>Modelos</dt>
                <dd>{preflight.models}</dd>
                <dt>Subcircuitos</dt>
                <dd>{preflight.subcircuits}</dd>
                <dt>Outputs</dt>
                <dd>{preflight.outputs.length}</dd>
              </dl>
            </div>
          )}
          <div className="fixed-job-actions">
            <button
              type="button"
              className="fixed-job-secondary-button"
              disabled={Boolean(validationError) || validating}
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
              El runner rootless no está habilitado.
              <button type="button" onClick={() => void refreshHealth()}>
                Actualizar
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
