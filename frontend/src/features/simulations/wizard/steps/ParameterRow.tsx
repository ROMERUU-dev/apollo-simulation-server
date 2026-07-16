import type { CSSProperties } from 'react'
import type { ParameterDefinition, ParameterMode, ParameterSweep } from '../../../../types'

const MODE_LABELS: Record<ParameterMode, string> = {
  fixed: 'Fijo',
  linear: 'Rango lineal',
  log: 'Rango logarítmico',
  list: 'Lista',
  original: 'Valor original',
  exclude: 'Excluir',
}

interface ParameterRowProps {
  parameter: ParameterDefinition
  sweep: ParameterSweep | undefined
  onUpdate: (patch: Partial<ParameterDefinition>) => void
}

const cellStyle: CSSProperties = { padding: '6px 5px', verticalAlign: 'middle' }
const inputStyle: CSSProperties = {
  width: '100%',
  padding: '5px 7px',
  border: '1px solid var(--color-divider)',
  background: 'var(--color-bg)',
  color: 'inherit',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12.5,
}

export function ParameterRow({ parameter, sweep, onUpdate }: ParameterRowProps) {
  const mode = parameter.mode
  return (
    <tr
      style={{
        borderBottom: '1px solid var(--color-divider)',
        opacity: mode === 'exclude' ? 0.5 : 1,
      }}
    >
      <td style={cellStyle}>
        <strong>{parameter.name}</strong>
      </td>
      <td style={cellStyle}>{parameter.originalValue}</td>
      <td style={cellStyle}>
        <select
          aria-label={`Modo para ${parameter.name}`}
          value={mode}
          onChange={(e) => onUpdate({ mode: e.target.value as ParameterMode })}
          style={inputStyle}
        >
          {(Object.keys(MODE_LABELS) as ParameterMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </td>
      <td style={cellStyle}>
        {mode === 'fixed' ? (
          <input
            aria-label={`Valor fijo para ${parameter.name}`}
            value={parameter.fixedValue}
            onChange={(e) => onUpdate({ fixedValue: e.target.value })}
            style={inputStyle}
          />
        ) : (
          <span style={{ opacity: 0.4 }}>—</span>
        )}
      </td>
      <td style={cellStyle}>
        {mode === 'linear' || mode === 'log' ? (
          <input
            aria-label={`Inicio de rango para ${parameter.name}`}
            value={parameter.rangeStart}
            onChange={(e) => onUpdate({ rangeStart: e.target.value })}
            style={inputStyle}
          />
        ) : (
          <span style={{ opacity: 0.4 }}>—</span>
        )}
      </td>
      <td style={cellStyle}>
        {mode === 'linear' || mode === 'log' ? (
          <input
            aria-label={`Fin de rango para ${parameter.name}`}
            value={parameter.rangeEnd}
            onChange={(e) => onUpdate({ rangeEnd: e.target.value })}
            style={inputStyle}
          />
        ) : (
          <span style={{ opacity: 0.4 }}>—</span>
        )}
      </td>
      <td style={cellStyle}>
        {mode === 'linear' || mode === 'log' ? (
          <input
            aria-label={`Paso para ${parameter.name}`}
            value={parameter.rangeStep}
            onChange={(e) => onUpdate({ rangeStep: e.target.value })}
            style={inputStyle}
          />
        ) : (
          <span style={{ opacity: 0.4 }}>—</span>
        )}
      </td>
      <td style={cellStyle}>
        {mode === 'list' ? (
          <input
            aria-label={`Lista de valores para ${parameter.name}`}
            value={parameter.listValues}
            onChange={(e) => onUpdate({ listValues: e.target.value })}
            placeholder="1, 2, 3"
            style={inputStyle}
          />
        ) : (
          <span style={{ opacity: 0.4 }}>—</span>
        )}
      </td>
      <td style={cellStyle}>{parameter.unit}</td>
      <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>
        {sweep?.valueCount ?? 1}
      </td>
    </tr>
  )
}
