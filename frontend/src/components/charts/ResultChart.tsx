import { useMemo } from 'react'
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
import type { WaveformPoint } from '../../api/waveform'
import { useThemeStore } from '../../hooks/useThemeStore'

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
  let current: MaybeWrapped<T> = module
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

export function ResultChart({ points }: { points: WaveformPoint[] }) {
  const theme = useThemeStore((state) => state.theme)
  const foreground = theme === 'dark' ? '#e7e8ea' : '#1d1f20'
  const divider = theme === 'dark' ? '#494e54' : '#d4d4d7'
  const option = useMemo(
    () => ({
      animation: false,
      backgroundColor: 'transparent',
      textStyle: { color: foreground },
      tooltip: { trigger: 'axis' },
      legend: { data: ['V(in)', 'V(out)'], top: 0, textStyle: { color: foreground } },
      grid: { left: 62, right: 24, top: 46, bottom: 64 },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'slider', xAxisIndex: 0, height: 18, bottom: 12 },
      ],
      xAxis: {
        type: 'value',
        name: 'Tiempo (ms)',
        nameLocation: 'middle',
        nameGap: 34,
        axisLine: { lineStyle: { color: divider } },
      },
      yAxis: {
        type: 'value',
        name: 'Voltaje (V)',
        axisLine: { lineStyle: { color: divider } },
        splitLine: { lineStyle: { color: divider, opacity: 0.45 } },
      },
      series: [
        {
          name: 'V(in)',
          type: 'line',
          showSymbol: false,
          smooth: false,
          data: points.map((point) => [point.timeSeconds * 1000, point.inputVolts]),
          lineStyle: { width: 1.5, color: '#5b8db8' },
        },
        {
          name: 'V(out)',
          type: 'line',
          showSymbol: false,
          smooth: false,
          data: points.map((point) => [point.timeSeconds * 1000, point.outputVolts]),
          lineStyle: { width: 2, color: '#4f9a70' },
        },
      ],
    }),
    [divider, foreground, points],
  )

  return (
    <div className="fixed-job-chart" aria-label="Gráfica de voltaje con las series V(in) y V(out)">
      <p className="visually-hidden">
        La gráfica contiene las series V(in) y V(out) para todas las muestras validadas.
      </p>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 420, width: '100%' }}
        notMerge
      />
    </div>
  )
}
