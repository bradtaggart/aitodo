import { describe, expect, it, vi } from 'vitest'
import { collapseStorageKey, nextPriority, readCollapsed, titleEditNextDraft, writeCollapsed } from './todo-item-interactions'

describe('todo item interactions', () => {
  it('cycles priority in the existing flag order', () => {
    expect(nextPriority(null)).toBe('high')
    expect(nextPriority('high')).toBe('medium')
    expect(nextPriority('medium')).toBe('low')
    expect(nextPriority('low')).toBeNull()
  })

  it('persists collapsed state under the todo-specific key', () => {
    const storage = new Map<string, string>()
    const localStorageLike = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { storage.set(key, value) }),
    }

    writeCollapsed(42, true, localStorageLike)

    expect(localStorageLike.setItem).toHaveBeenCalledWith(collapseStorageKey(42), 'true')
    expect(readCollapsed(42, localStorageLike)).toBe(true)
  })

  it('resets the title draft when editing is inactive', () => {
    expect(titleEditNextDraft({
      currentText: 'current',
      draft: 'stale',
      isEditing: false,
    })).toBe('current')
  })
})
