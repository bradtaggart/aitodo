import { useCallback, useEffect, useRef, useState } from 'react'

export type Priority = 'high' | 'medium' | 'low' | null

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const PRIORITY_CYCLE: Record<Exclude<Priority, null>, Priority> = {
  high: 'medium',
  medium: 'low',
  low: null,
}

export function nextPriority(priority: Priority): Priority {
  return priority ? PRIORITY_CYCLE[priority] : 'high'
}

export function collapseStorageKey(todoId: number): string {
  return `collapsed:${todoId}`
}

export function readCollapsed(todoId: number, storage: StorageLike = localStorage): boolean {
  return storage.getItem(collapseStorageKey(todoId)) === 'true'
}

export function writeCollapsed(todoId: number, collapsed: boolean, storage: StorageLike = localStorage): void {
  storage.setItem(collapseStorageKey(todoId), String(collapsed))
}

export function titleEditNextDraft({
  currentText,
  draft,
  isEditing,
}: {
  currentText: string
  draft: string
  isEditing: boolean
}): string {
  return isEditing ? draft : currentText
}

export function useTitleEdit(currentText: string, onSave: (text: string) => void) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(currentText)
  const cancelledRef = useRef(false)

  useEffect(() => {
    setDraft(prev => titleEditNextDraft({ currentText, draft: prev, isEditing }))
  }, [currentText, isEditing])

  const start = useCallback(() => {
    setDraft(currentText)
    setIsEditing(true)
  }, [currentText])

  const handleBlur = useCallback(() => {
    if (cancelledRef.current) { cancelledRef.current = false; return }
    const trimmed = draft.trim()
    if (trimmed && trimmed !== currentText) onSave(trimmed)
    else setDraft(currentText)
    setIsEditing(false)
  }, [draft, currentText, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelledRef.current = true
      setDraft(currentText)
      setIsEditing(false)
    }
    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
  }, [currentText])

  return {
    isEditing,
    start,
    inputProps: {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
  }
}

export function usePersistentCollapse(todoId: number) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(todoId))

  const toggleCollapse = useCallback(() => {
    setCollapsed(value => {
      const next = !value
      writeCollapsed(todoId, next)
      return next
    })
  }, [todoId])

  return { collapsed, toggleCollapse }
}

export function useChildTaskForm(onAddChild: (text: string) => void | Promise<void>) {
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    await onAddChild(text)
    setInput('')
    setAdding(false)
  }

  return {
    adding,
    setAdding,
    input,
    setInput,
    handleSubmit,
  }
}
