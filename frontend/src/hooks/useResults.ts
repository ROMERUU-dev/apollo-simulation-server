import { useCallback, useEffect, useState } from 'react'
import { resultService } from '../services'
import type { SimulationResult } from '../types'

export function useResults() {
  const [results, setResults] = useState<SimulationResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    resultService.list().then((list) => {
      setResults(list)
      setLoading(false)
    })
  }, [])

  return { results, loading }
}

export function useResult(resultId: string | undefined) {
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!resultId) {
      setLoading(false)
      return
    }
    resultService.get(resultId).then((r) => {
      setResult(r)
      setLoading(false)
    })
  }, [resultId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { result, loading }
}
