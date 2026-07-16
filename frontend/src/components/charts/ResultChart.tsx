import { useMemo, useState } from 'react'
import ReactEChartsCoreImport from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useThemeStore } from '../../hooks/useThemeStore'
import type { SimulationResult } from '../../types'

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  CanvasRenderer,
])

// Vite's dev CJS interop double-wraps this deep subpath import (returns
// { default: Component } instead of Component); peel off any wrapper layers.
type MaybeWrapped<T> = T | { default: MaybeWrapped<T> }
function unwrapDefault<T>(mod: MaybeWrapped<T>): T {
  let current: MaybeWrapped<T> = mod
  while (
    typeof current !== 'function' &&
    current !== null &&
    typeof current === 'object' &&
    'default' in current
  ) {
    current = current.default
  }
  return current as T
}

const ReactEChartsCore = unwrapDefault<typeof ReactEChartsCoreImport>(ReactEChartsCoreImport)

interface ResultChartProps {
  result: SimulationResult
}

export function ResultChart({ result }: ResultChartProps) {
  const theme = useThemeStore((s) => s.theme)
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    new Set(result.series.map((s) => s.name)),
  )
  const [yScale, setYScale] = useState<'linear' | 'log'>('linear')

  function toggleSeries(name: string) {
    setVisibleSeries((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      textStyle: { color: theme === 'dark' ? '#e7e8ea' : '#1d1f20' },
      tooltip: { trigger: 'axis' },
      legend: {
        data: result.series.map((s) => s.name),
        top: 0,
        textStyle: { color: theme === 'dark' ? '#e7e8ea' : '#1d1f20' },
      },
      grid: { left: 56, right: 24, top: 44, bottom: 60 },
      toolbox: {
        feature: {
          dataZoom: { yAxisIndex: 'none' },
          restore: {},
          saveAsImage: { title: 'Exportar' },
        },
        right: 10,
        iconStyle: { borderColor: theme === 'dark' ? '#a7abaf' : '#5d5d60' },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'slider', xAxisIndex: 0, height: 18, bottom: 12 },
      ],
      xAxis: {
        type: 'value',
        name: `${result.xAxis.name} (${result.xAxis.unit})`,
        nameLocation: 'middle',
        nameGap: 30,
        axisLine: { lineStyle: { color: theme === 'dark' ? '#494e54' : '#d4d4d7' } },
      },
      yAxis: {
        type: yScale === 'log' ? 'log' : 'value',
        name: 'Valor',
        axisLine: { lineStyle: { color: theme === 'dark' ? '#494e54' : '#d4d4d7' } },
      },
      series: result.series
        .filter((s) => visibleSeries.has(s.name))
        .map((s) => ({
          name: s.name,
          type: 'line',
          showSymbol: false,
          data: result.xAxis.values.map((x, i) => [x, s.values[i]]),
        })),
    }),
    [result, theme, visibleSeries, yScale],
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <fieldset style={{ display: 'flex', gap: 10, border: 'none', padding: 0, margin: 0 }}>
          <legend className="visually-hidden">Series visibles</legend>
          {result.series.map((s) => (
            <label
              key={s.name}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}
            >
              <input
                type="checkbox"
                checked={visibleSeries.has(s.name)}
                onChange={() => toggleSeries(s.name)}
              />
              {s.name}
            </label>
          ))}
        </fieldset>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          Escala Y
          <select
            value={yScale}
            onChange={(e) => setYScale(e.target.value as 'linear' | 'log')}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-surface)',
              color: 'inherit',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <option value="linear">Lineal</option>
            <option value="log">Logarítmica</option>
          </select>
        </label>
      </div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 420, width: '100%' }}
        notMerge
      />
    </div>
  )
}
