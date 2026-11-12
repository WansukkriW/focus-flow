import type { Session, Task } from '../../shared/types'

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Midnight (local) of the day containing ts. */
export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Adds whole calendar days, staying correct across daylight-saving changes. */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export interface DayTotal {
  key: string
  date: number
  /** Completed focus rounds. */
  rounds: number
  /** All focused minutes, including rounds that were skipped part way. */
  minutes: number
}

export interface Summary {
  today: DayTotal
  week: { rounds: number; minutes: number }
  /** Consecutive days with at least one completed round, ending today (or yesterday). */
  streak: number
  bestDay: DayTotal | null
}

function focusSessions(history: Session[]): Session[] {
  return history.filter((s) => s.type === 'focus')
}

export function totalsByDay(history: Session[]): Map<string, DayTotal> {
  const map = new Map<string, DayTotal>()
  for (const s of focusSessions(history)) {
    const key = dayKey(s.endedAt)
    const day = map.get(key) ?? { key, date: startOfDay(s.endedAt), rounds: 0, minutes: 0 }
    day.minutes += s.minutes
    if (s.completed) day.rounds += 1
    map.set(key, day)
  }
  return map
}

/** One entry per day for the last `count` days, oldest first, zero-filled. */
export function lastDays(history: Session[], count: number, now = Date.now()): DayTotal[] {
  const byDay = totalsByDay(history)
  const today = startOfDay(now)
  const days: DayTotal[] = []
  for (let i = count - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    const key = dayKey(date)
    days.push(byDay.get(key) ?? { key, date, rounds: 0, minutes: 0 })
  }
  return days
}

export function summarize(history: Session[], now = Date.now()): Summary {
  const byDay = totalsByDay(history)
  const todayStart = startOfDay(now)
  const todayKey = dayKey(now)
  const today = byDay.get(todayKey) ?? { key: todayKey, date: todayStart, rounds: 0, minutes: 0 }

  // The week starts on Monday.
  const weekday = (new Date(now).getDay() + 6) % 7
  const weekStart = addDays(todayStart, -weekday)
  const week = { rounds: 0, minutes: 0 }
  for (const day of byDay.values()) {
    if (day.date >= weekStart && day.date <= todayStart) {
      week.rounds += day.rounds
      week.minutes += day.minutes
    }
  }

  // A streak still counts if today simply hasn't had a round yet.
  let streak = 0
  let cursor = today.rounds > 0 ? todayStart : addDays(todayStart, -1)
  while ((byDay.get(dayKey(cursor))?.rounds ?? 0) > 0) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  let bestDay: DayTotal | null = null
  for (const day of byDay.values()) {
    if (day.rounds > 0 && (!bestDay || day.rounds > bestDay.rounds)) bestDay = day
  }
  return { today, week, streak, bestDay }
}

/**
 * Focus minutes per [weekday 0=Mon..6=Sun][hour 0..23] over the last `days` days.
 * A session that spans several hours is split across them.
 */
export function hourHeatmap(history: Session[], days = 30, now = Date.now()): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  const since = addDays(startOfDay(now), -(days - 1))
  for (const s of focusSessions(history)) {
    if (s.endedAt < since) continue
    // Pauses stretch startedAt..endedAt, so measure back from the end by the time focused.
    let cursor = s.endedAt - s.minutes * 60_000
    const end = s.endedAt
    while (cursor < end) {
      const d = new Date(cursor)
      const nextHour = new Date(d)
      nextHour.setMinutes(60, 0, 0)
      const sliceEnd = Math.min(end, nextHour.getTime())
      grid[(d.getDay() + 6) % 7][d.getHours()] += (sliceEnd - cursor) / 60_000
      cursor = sliceEnd
    }
  }
  return grid
}

export interface TaskTime {
  id: string | null
  title: string | null
  minutes: number
}

/** Minutes per task, largest first; tasks past `limit` fold into one "other" row. */
export function timeByTask(history: Session[], tasks: Task[], limit = 6): TaskTime[] {
  const titles = new Map(tasks.map((t) => [t.id, t.title]))
  const totals = new Map<string | null, number>()
  for (const s of focusSessions(history)) {
    // Tasks deleted since then are grouped with "no task".
    const id = s.taskId && titles.has(s.taskId) ? s.taskId : null
    totals.set(id, (totals.get(id) ?? 0) + s.minutes)
  }
  const rows = [...totals.entries()]
    .map(([id, minutes]) => ({ id, title: id ? (titles.get(id) ?? null) : null, minutes }))
    .filter((r) => r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
  if (rows.length <= limit) return rows
  const other = rows.slice(limit - 1).reduce((sum, r) => sum + r.minutes, 0)
  return [...rows.slice(0, limit - 1), { id: 'other', title: null, minutes: other }]
}
