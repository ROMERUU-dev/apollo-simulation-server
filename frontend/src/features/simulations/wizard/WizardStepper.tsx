import { Check } from 'lucide-react'
import { WIZARD_STEP_LABELS } from './wizardTypes'

interface WizardStepperProps {
  currentStep: number
  furthestStep: number
  onStepSelect: (step: number) => void
}

export function WizardStepper({ currentStep, furthestStep, onStepSelect }: WizardStepperProps) {
  return (
    <ol
      aria-label="Pasos del asistente de simulación"
      style={{
        display: 'flex',
        gap: 4,
        listStyle: 'none',
        margin: '0 0 24px',
        padding: 0,
        flexWrap: 'wrap',
      }}
    >
      {WIZARD_STEP_LABELS.map((label, index) => {
        const isCurrent = index === currentStep
        const isDone = index < currentStep
        const isReachable = index <= furthestStep
        return (
          <li key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => isReachable && onStepSelect(index)}
              disabled={!isReachable}
              aria-current={isCurrent ? 'step' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                border: '1px solid var(--color-divider)',
                borderRadius: 999,
                background: isCurrent
                  ? 'var(--color-accent)'
                  : isDone
                    ? 'var(--color-accent-200)'
                    : 'transparent',
                color: isCurrent ? 'var(--color-bg)' : 'inherit',
                cursor: isReachable ? 'pointer' : 'not-allowed',
                opacity: isReachable ? 1 : 0.45,
                fontSize: 13,
                fontWeight: isCurrent ? 600 : 500,
              }}
            >
              {isDone ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <span aria-hidden="true">{index + 1}</span>
              )}
              {label}
            </button>
            {index < WIZARD_STEP_LABELS.length - 1 && (
              <span
                aria-hidden="true"
                style={{ width: 16, height: 1, background: 'var(--color-divider)' }}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
