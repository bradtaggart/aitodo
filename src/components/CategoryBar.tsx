import { useState } from 'react'
import type { Category } from '../types'

const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899']

interface Props {
  categories: Category[]
  activeCat: number | null
  onSelect: (id: number | null) => void
  onAdd: (name: string, color: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export function CategoryBar({ categories, activeCat, onSelect, onAdd, onDelete }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[5])

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd(name.trim(), color)
    setName('')
    setColor(PRESET_COLORS[5])
    setAdding(false)
  }

  return (
    <div className="cat-bar">
      {categories.map(cat => (
        <button
          key={cat.id}
          type="button"
          className={`cat-chip${activeCat === cat.id ? ' active' : ''}`}
          onClick={() => onSelect(activeCat === cat.id ? null : cat.id)}
        >
          <span className="cat-dot" style={{ background: cat.color }} />
          {cat.name}
          <span
            className="cat-del"
            role="button"
            aria-label={`Delete ${cat.name}`}
            onClick={e => { e.stopPropagation(); onDelete(cat.id) }}
          >×</span>
        </button>
      ))}
      {adding ? (
        <form onSubmit={handleSubmit} className="cat-add-form">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Category name..."
            maxLength={30}
          />
          <div className="color-swatches">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`swatch${color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <button type="submit">Add</button>
          <button type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button className="cat-add-btn" type="button" onClick={() => setAdding(true)}>+ Category</button>
      )}
    </div>
  )
}
