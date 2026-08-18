import { useMemo, useState } from 'react'
import ReactEChartsCoreImport from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { GenericResults } from '../../api/resultsCsv'

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
])

type MaybeWrapped<T> = T | { default: MaybeWrapped<T> }
function unwrapDefault<T>(module: MaybeWrapped<T>): T {
  let current = module
  while (
    typeof current !== 'function' &&
    current &&
    typeof current === 'object' &&
    'default' in current
  )
    current = current.default
  return current as T
}
const ReactEChartsCore = unwrapDefault<typeof ReactEChartsCoreImport>(ReactEChartsCoreImport)

export function GenericResultChart({ results }: { results: GenericResults }) {
  const [xIndex, setXIndex] = useState(0)
  const [selected, setSelected] = useState<number[]>(
    results.columns.slice(1, 3).map((_, index) => index + 1),
  )
  const option = useMemo(
    () => ({
      animation: false,
      tooltip: { trigger: 'axis' },
      legend: { data: selected.map((index) => results.columns[index]) },
      grid: { left: 64, right: 24, top: 46, bottom: 64 },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 12 }],
      xAxis: { type: 'value', name: results.columns[xIndex] },
      yAxis: { type: 'value' },
      series: selected.map((index) => ({
        type: 'line',
        name: results.columns[index],
        showSymbol: false,
        data: results.rows.map((row) => [row[xIndex], row[index]]),
      })),
    }),
    [results, selected, xIndex],
  )

  function toggle(index: number) {
    setSelected((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : current.length < 6
          ? [...current, index]
          : current,
    )
  }

  return (
    <div className="generic-results-chart">
      <div className="generic-series-controls">
        <label>
          Eje X{' '}
          <select value={xIndex} onChange={(event) => setXIndex(Number(event.target.value))}>
            {results.columns.map((column, index) => (
              <option key={column} value={index}>
                {column}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Series Y, máximo 6</legend>
          {results.columns.map((column, index) =>
            index === xIndex ? null : (
              <label key={column}>
                <input
                  type="checkbox"
                  checked={selected.includes(index)}
                  onChange={() => toggle(index)}
                />
                {column}
              </label>
            ),
          )}
        </fieldset>
      </div>
      <p className="visually-hidden">
        Gráfica de resultados con {selected.length} series seleccionadas.
      </p>
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 420 }} notMerge />
    </div>
  )
}
