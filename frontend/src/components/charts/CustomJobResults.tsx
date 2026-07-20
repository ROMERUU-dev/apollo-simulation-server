import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { fetchResults, type GenericResults } from '../../api/resultsCsv'
import { ErrorState } from '../feedback/ErrorState'
import { LoadingState } from '../feedback/LoadingState'
import { GenericResultChart } from './GenericResultChart'

export function CustomJobResults({ jobId }: { jobId: string }) {
  const [results, setResults] = useState<GenericResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetchResults(jobId, { signal: controller.signal })
      .then(setResults)
      .catch(() => {
        if (!controller.signal.aborted) setError('No fue posible validar results.csv.')
      })
    return () => controller.abort()
  }, [jobId])
  if (error) return <ErrorState title="Resultados no disponibles" description={error} />
  if (!results) return <LoadingState label="Validando results.csv…" />
  return (
    <section aria-labelledby="custom-results-heading">
      <div className="fixed-job-section-heading">
        <div>
          <h2 id="custom-results-heading">Resultados Xyce</h2>
          <p>
            {results.rows.length.toLocaleString('es-MX')} filas · {results.columns.length} columnas
            validadas.
          </p>
        </div>
        <a
          className="fixed-job-primary-button"
          href={`/api/jobs/${jobId}/artifacts/results.csv`}
          download
        >
          <Download size={16} /> Descargar results.csv
        </a>
      </div>
      <GenericResultChart results={results} />
    </section>
  )
}
