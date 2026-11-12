import { randomUUID } from 'crypto'
import type { Settings, Task, TaskPatch } from '../shared/types'
import { clampInt, type Stores } from './store'
import type { PhaseEndEvent } from './timer'

/** Phases shorter than this (e.g. skipped right after starting) are not worth recording. */
const MIN_RECORDED_MS = 5_000

export function addTask(stores: Stores, title: unknown, estimate: unknown): Task[] {
  const text = typeof title === 'string' ? title.trim().slice(0, 200) : ''
  if (!text) return stores.tasks.get()
  const task: Task = {
    id: randomUUID(),
    title: text,
    estimatedPomodoros: clampInt(estimate, 1, 99, 1),
    completedPomodoros: 0,
    done: false,
    createdAt: Date.now()
  }
  const tasks = [...stores.tasks.get(), task]
  stores.tasks.set(tasks)
  return tasks
}

/** Applies a patch; returns a settings change too when the active task is finished. */
export function updateTask(
  stores: Stores,
  id: unknown,
  patch: unknown
): { tasks: Task[]; settings?: Partial<Settings> } {
  const input = (typeof patch === 'object' && patch !== null ? patch : {}) as TaskPatch
  const tasks = stores.tasks.get().map((task) => {
    if (task.id !== id) return task
    const next = { ...task }
    if (typeof input.title === 'string' && input.title.trim()) {
      next.title = input.title.trim().slice(0, 200)
    }
    if (input.estimatedPomodoros !== undefined) {
      next.estimatedPomodoros = clampInt(input.estimatedPomodoros, 1, 99, task.estimatedPomodoros)
    }
    if (typeof input.done === 'boolean') next.done = input.done
    return next
  })
  stores.tasks.set(tasks)
  const finishedActive = input.done === true && stores.settings.get().activeTaskId === id
  return { tasks, settings: finishedActive ? { activeTaskId: null } : undefined }
}

export function removeTask(
  stores: Stores,
  id: unknown
): { tasks: Task[]; settings?: Partial<Settings> } {
  const tasks = stores.tasks.get().filter((t) => t.id !== id)
  stores.tasks.set(tasks)
  const wasActive = stores.settings.get().activeTaskId === id
  return { tasks, settings: wasActive ? { activeTaskId: null } : undefined }
}

/** Reorders by the given ids; anything not listed keeps its place at the end. */
export function reorderTasks(stores: Stores, ids: unknown): Task[] {
  if (!Array.isArray(ids)) return stores.tasks.get()
  const byId = new Map(stores.tasks.get().map((t) => [t.id, t]))
  const ordered: Task[] = []
  for (const id of ids) {
    const task = byId.get(id)
    if (task) {
      ordered.push(task)
      byId.delete(id)
    }
  }
  const tasks = [...ordered, ...byId.values()]
  stores.tasks.set(tasks)
  return tasks
}

/**
 * Writes a finished phase to history and, for a completed focus round, counts it on the
 * active task. Returns what changed so the caller can tell the windows.
 */
export function recordPhaseEnd(
  stores: Stores,
  event: PhaseEndEvent
): { history: boolean; tasks: boolean } {
  const changed = { history: false, tasks: false }
  const { activeTaskId } = stores.settings.get()
  const taskId = event.phase === 'focus' ? activeTaskId : null

  if (event.startedAt !== null && event.elapsedMs >= MIN_RECORDED_MS) {
    stores.history.set([
      ...stores.history.get(),
      {
        id: randomUUID(),
        type: event.phase,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        minutes: Math.round((event.elapsedMs / 60_000) * 10) / 10,
        taskId,
        completed: event.completed
      }
    ])
    changed.history = true
  }

  if (event.phase === 'focus' && event.completed && taskId) {
    const tasks = stores.tasks.get()
    if (tasks.some((t) => t.id === taskId)) {
      stores.tasks.set(
        tasks.map((t) =>
          t.id === taskId ? { ...t, completedPomodoros: t.completedPomodoros + 1 } : t
        )
      )
      changed.tasks = true
    }
  }
  return changed
}
