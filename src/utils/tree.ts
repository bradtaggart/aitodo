import type { Todo } from '../types'

export function buildTree(todos: Todo[]): {
  topLevel: Todo[]
  subtasksOf: (id: number) => Todo[]
} {
  const childMap = new Map<number, Todo[]>()
  const topLevel: Todo[] = []

  for (const todo of todos) {
    if (todo.parent_id === null) {
      topLevel.push(todo)
    } else {
      if (!childMap.has(todo.parent_id)) childMap.set(todo.parent_id, [])
      childMap.get(todo.parent_id)!.push(todo)
    }
  }

  return {
    topLevel,
    subtasksOf: (id: number) => childMap.get(id) ?? [],
  }
}
