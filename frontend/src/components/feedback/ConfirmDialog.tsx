import { useEffect, useRef } from 'react'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClose={onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div className={styles.body}>
        <h2 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h2>
        <p id="confirm-dialog-description" className={styles.description}>
          {description}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? styles.buttonDanger : styles.buttonPrimary}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
