import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import styles from '../../components/feedback/ConfirmDialog.module.css'
import type { CreateProjectInput } from '../../services/types'

interface CreateProjectDialogProps {
  open: boolean
  onCancel: () => void
  onCreate: (input: CreateProjectInput) => void
}

export function CreateProjectDialog({ open, onCancel, onCreate }: CreateProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setName('')
      setDescription('')
      setTags('')
      setNameError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('El nombre del proyecto es obligatorio.')
      return
    }
    onCreate({
      name: trimmedName,
      description: description.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    })
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClose={onCancel}
      aria-labelledby="create-project-title"
    >
      <form className={styles.body} onSubmit={handleSubmit} noValidate>
        <h2 id="create-project-title" className={styles.title}>
          Nuevo proyecto
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          <label htmlFor="project-name" style={{ fontSize: 13, fontWeight: 600 }}>
            Nombre
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'project-name-error' : undefined}
            style={{
              padding: '8px 10px',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-bg)',
              color: 'inherit',
              borderRadius: 'var(--radius-sm)',
            }}
          />
          {nameError && (
            <span
              id="project-name-error"
              role="alert"
              style={{ color: 'var(--status-bad)', fontSize: 12 }}
            >
              {nameError}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          <label htmlFor="project-description" style={{ fontSize: 13, fontWeight: 600 }}>
            Descripción
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{
              padding: '8px 10px',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-bg)',
              color: 'inherit',
              borderRadius: 'var(--radius-sm)',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          <label htmlFor="project-tags" style={{ fontSize: 13, fontWeight: 600 }}>
            Etiquetas (separadas por coma)
          </label>
          <input
            id="project-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="analógico, potencia…"
            style={{
              padding: '8px 10px',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-bg)',
              color: 'inherit',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className={styles.buttonPrimary}>
            Crear proyecto
          </button>
        </div>
      </form>
    </dialog>
  )
}
