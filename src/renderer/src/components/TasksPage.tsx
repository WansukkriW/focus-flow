import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { useState } from 'react'
import type { Settings, Task } from '../../../shared/types'
import { useT } from '../i18n'
import { CheckIcon, GripIcon, MinusIcon, PencilIcon, PlusIcon, TrashIcon } from './icons'

interface Props {
  tasks: Task[]
  settings: Settings
}

function EstimateStepper({
  value,
  onChange
}: {
  value: number
  onChange: (value: number) => void
}): React.JSX.Element {
  const t = useT()
  return (
    <div className="mini-stepper" title={t('tasks.estimate')}>
      <button
        type="button"
        aria-label={t('settings.decrease')}
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <MinusIcon width={14} height={14} />
      </button>
      <span aria-label={t('tasks.estimate')}>🍅 {value}</span>
      <button
        type="button"
        aria-label={t('settings.increase')}
        disabled={value >= 99}
        onClick={() => onChange(Math.min(99, value + 1))}
      >
        <PlusIcon width={14} height={14} />
      </button>
    </div>
  )
}

function AddTaskForm(): React.JSX.Element {
  const t = useT()
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState(1)
  const submit = (): void => {
    if (!title.trim()) return
    window.api.tasks.add(title, estimate)
    setTitle('')
    setEstimate(1)
  }
  return (
    <form
      className="card task-form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        className="task-input"
        value={title}
        maxLength={200}
        placeholder={t('tasks.placeholder')}
        onChange={(e) => setTitle(e.target.value)}
      />
      <EstimateStepper value={estimate} onChange={setEstimate} />
      <motion.button
        type="submit"
        className="task-add"
        aria-label={t('tasks.add')}
        disabled={!title.trim()}
        whileTap={{ scale: 0.9 }}
      >
        <PlusIcon width={18} height={18} />
      </motion.button>
    </form>
  )
}

function TaskRow({
  task,
  active,
  onDragStart
}: {
  task: Task
  active: boolean
  /** Present for reorderable rows: starts a drag from the grip. */
  onDragStart?: (e: React.PointerEvent) => void
}): React.JSX.Element {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [estimate, setEstimate] = useState(task.estimatedPomodoros)

  const startEdit = (): void => {
    setTitle(task.title)
    setEstimate(task.estimatedPomodoros)
    setEditing(true)
  }
  const save = (): void => {
    window.api.tasks.update(task.id, { title, estimatedPomodoros: estimate })
    setEditing(false)
  }
  const toggleActive = (): void => {
    if (task.done) return
    window.api.settings.update({ activeTaskId: active ? null : task.id })
  }

  if (editing) {
    return (
      <form
        className="task-row editing"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input
          className="task-input"
          value={title}
          maxLength={200}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setEditing(false)
            }
          }}
        />
        <EstimateStepper value={estimate} onChange={setEstimate} />
        <button type="submit" className="text-btn">
          {t('tasks.save')}
        </button>
        <button type="button" className="text-btn muted" onClick={() => setEditing(false)}>
          {t('tasks.cancel')}
        </button>
      </form>
    )
  }

  const over = task.completedPomodoros > task.estimatedPomodoros
  return (
    <div className={`task-row${active ? ' active' : ''}${task.done ? ' done' : ''}`}>
      {onDragStart && <DragHandle onPointerDown={onDragStart} />}
      <button
        className={`task-check${task.done ? ' checked' : ''}`}
        aria-label={task.done ? t('tasks.markUndone') : t('tasks.markDone')}
        title={task.done ? t('tasks.markUndone') : t('tasks.markDone')}
        onClick={() => window.api.tasks.update(task.id, { done: !task.done })}
      >
        {task.done && <CheckIcon width={12} height={12} />}
      </button>
      <button
        className="task-main"
        onClick={toggleActive}
        disabled={task.done}
        title={task.done ? undefined : active ? t('tasks.unsetActive') : t('tasks.setActive')}
      >
        <span className="task-title">{task.title}</span>
        {active && <span className="task-badge">{t('tasks.active')}</span>}
      </button>
      <span className={`task-count${over ? ' over' : ''}`}>
        🍅{' '}
        {t('tasks.pomodoros', { done: task.completedPomodoros, estimate: task.estimatedPomodoros })}
      </span>
      <div className="task-actions">
        <button aria-label={t('tasks.edit')} title={t('tasks.edit')} onClick={startEdit}>
          <PencilIcon />
        </button>
        <button
          aria-label={t('tasks.delete')}
          title={t('tasks.delete')}
          onClick={() => window.api.tasks.remove(task.id)}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

/** Drag handle; the row itself is not draggable so text and buttons stay clickable. */
function DragHandle({
  onPointerDown
}: {
  onPointerDown: (e: React.PointerEvent) => void
}): React.JSX.Element {
  const t = useT()
  return (
    <span
      className="task-grip"
      title={t('tasks.drag')}
      aria-hidden="true"
      onPointerDown={onPointerDown}
    >
      <GripIcon />
    </span>
  )
}

function OpenTaskItem({ task, active }: { task: Task; active: boolean }): React.JSX.Element {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      className="task-item"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
    >
      <TaskRow task={task} active={active} onDragStart={(e) => controls.start(e)} />
    </Reorder.Item>
  )
}

export function TasksPage({ tasks, settings }: Props): React.JSX.Element {
  const t = useT()
  const done = tasks.filter((task) => task.done)
  // Local order while dragging; saved when the drag ends. Reset whenever the saved list changes.
  const [open, setOpen] = useState(() => tasks.filter((task) => !task.done))
  const [source, setSource] = useState(tasks)
  if (source !== tasks) {
    setSource(tasks)
    setOpen(tasks.filter((task) => !task.done))
  }

  const saveOrder = (): void => {
    const ids = [...open, ...done].map((task) => task.id)
    if (ids.join() !== tasks.map((task) => task.id).join()) window.api.tasks.reorder(ids)
  }

  return (
    <div className="tasks-page">
      <AddTaskForm />

      {tasks.length === 0 ? (
        <p className="tasks-empty">{t('tasks.empty')}</p>
      ) : open.length === 0 ? (
        <p className="tasks-empty">{t('tasks.allDone')}</p>
      ) : (
        <Reorder.Group
          axis="y"
          values={open}
          onReorder={setOpen}
          className="task-list"
          onPointerUp={saveOrder}
        >
          <AnimatePresence initial={false}>
            {open.map((task) => (
              <OpenTaskItem key={task.id} task={task} active={settings.activeTaskId === task.id} />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {done.length > 0 && (
        <>
          <button
            className="text-btn tasks-toggle-done"
            onClick={() => window.api.settings.update({ showDoneTasks: !settings.showDoneTasks })}
          >
            {settings.showDoneTasks ? t('tasks.hideDone') : t('tasks.showDone', { n: done.length })}
          </button>
          <AnimatePresence initial={false}>
            {settings.showDoneTasks && (
              <motion.div
                className="task-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {done.map((task) => (
                  <div key={task.id} className="task-item">
                    <TaskRow task={task} active={false} />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
