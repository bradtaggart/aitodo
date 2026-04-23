import { useState } from 'react'

interface Props {
  value: string | null
  onChange: (v: string | null) => void
}

export function DescriptionField({ value, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  function startEditing() {
    setDraft(value ?? '')
    setEditing(true)
  }

  function handleBlur() {
    onChange(draft.trim() || null)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(value ?? '')
      setEditing(false)
    }
  }

  return (
    <div className="description-field">
      {editing ? (
        <>
          <textarea
            autoFocus
            className="description-textarea"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <div className="description-hint">Click away to save · Esc to cancel</div>
        </>
      ) : (
        <div
          className={`description-display${value ? '' : ' empty'}`}
          onClick={startEditing}
          role="button"
          aria-label={value ? 'Edit description' : 'Add description'}
        >
          {value || 'Add a description…'}
        </div>
      )}
    </div>
  )
}
