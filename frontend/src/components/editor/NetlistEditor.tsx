import { useRef } from 'react'
import styles from './NetlistEditor.module.css'

interface NetlistEditorProps {
  id: string
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  readOnly?: boolean
}

export function NetlistEditor({ id, value, onChange, ariaLabel, readOnly }: NetlistEditorProps) {
  const gutterRef = useRef<HTMLPreElement>(null)
  const lineCount = Math.max(value.split('\n').length, 1)
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')

  return (
    <div className={styles.wrapper}>
      <pre className={styles.gutter} ref={gutterRef} aria-hidden="true">
        {lineNumbers}
      </pre>
      <textarea
        id={id}
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
        }}
        aria-label={ariaLabel}
        readOnly={readOnly}
        spellCheck={false}
      />
    </div>
  )
}
