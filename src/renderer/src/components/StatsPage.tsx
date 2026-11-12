import { useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, Settings, Task } from '../../../shared/types'
import { LanguageContext, useT } from '../i18n'
import { hourHeatmap, lastDays, summarize, timeByTask, type DayTotal } from '../stats'

interface Props {
  history: Session[]
  tasks: Task[]
  settings: Settings
}

/** Width of an element, kept up to date so charts draw at real pixel size. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

function useLocale(): string {
  return useContext(LanguageContext) === 'th' ? 'th-TH' : 'en-US'
}

/** "1 round" vs "2 rounds" (Thai uses the same word for both). */
function useCount(): (n: number, unit: 'rounds' | 'days') => string {
  const t = useT()
  return (n, unit) =>
    unit === 'rounds'
      ? t(n === 1 ? 'stats.roundsOne' : 'stats.rounds', { n })
      : t(n === 1 ? 'stats.daysOne' : 'stats.days', { n })
}

function useFormatMinutes(): (minutes: number) => string {
  const t = useT()
  return (minutes) => {
    const total = Math.round(minutes)
    if (total < 60) return t('stats.minutes', { n: total })
    return t('stats.hoursMinutes', { h: Math.floor(total / 60), m: total % 60 })
  }
}

interface TooltipState {
  x: number
  y: number
  content: ReactNode
}

/** Floating label for the hovered mark, placed inside the chart's own box. */
function Tooltip({ tip }: { tip: TooltipState | null }): React.JSX.Element | null {
  if (!tip) return null
  return (
    <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  )
}

function StatTile({
  label,
  value,
  sub
}: {
  label: string
  value: string
  sub?: string
}): React.JSX.Element {
  return (
    <div className="card stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

function GoalMeter({ done, goal }: { done: number; goal: number }): React.JSX.Element {
  const t = useT()
  const share = Math.min(1, done / goal)
  return (
    <div className="card goal-card">
      <div className="goal-head">
        <span className="stat-label">{t('stats.goal')}</span>
        <span className="goal-count">
          {done >= goal ? t('stats.goalReached') : `${done} / ${goal}`}
        </span>
      </div>
      <div
        className="goal-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={done}
      >
        <div className="goal-fill" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  )
}

/** Rounds the axis maximum up to a clean step so tick labels read naturally. */
function niceMax(value: number): { max: number; step: number } {
  if (value <= 4) return { max: 4, step: 2 }
  const step = value <= 10 ? 2 : value <= 20 ? 5 : 10
  return { max: Math.ceil(value / step) * step, step }
}

/** Column path with a 4px rounded top and a square base. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

function DailyChart({ days, goal }: { days: DayTotal[]; goal: number }): React.JSX.Element {
  const t = useT()
  const count = useCount()
  const locale = useLocale()
  const formatMinutes = useFormatMinutes()
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)

  const height = 150
  const pad = { top: 18, right: 4, bottom: 22, left: 24 }
  const plotW = Math.max(0, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom
  const peak = Math.max(...days.map((d) => d.rounds))
  const { max, step } = niceMax(Math.max(peak, goal))
  const slot = plotW / days.length
  const barW = Math.min(24, Math.max(3, slot - 2))
  const y = (v: number): number => pad.top + plotH - (v / max) * plotH
  const short = days.length <= 7
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const full = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  const peakIndex = peak > 0 ? days.findIndex((d) => d.rounds === peak) : -1

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={t('stats.daily')}>
          {Array.from({ length: max / step + 1 }, (_, i) => i * step).map((v) => (
            <g key={v}>
              <line
                className="chart-grid"
                x1={pad.left}
                x2={width - pad.right}
                y1={y(v)}
                y2={y(v)}
              />
              <text className="chart-tick" x={pad.left - 6} y={y(v) + 4} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          <line
            className="chart-goal"
            x1={pad.left}
            x2={width - pad.right}
            y1={y(goal)}
            y2={y(goal)}
          />
          {days.map((day, i) => {
            const x = pad.left + i * slot + (slot - barW) / 2
            const h = (day.rounds / max) * plotH
            const showLabel = short || i % 5 === (days.length - 1) % 5
            return (
              <g key={day.key}>
                {h > 0 && <path className="chart-bar" d={columnPath(x, y(day.rounds), barW, h)} />}
                {i === peakIndex && (
                  <text
                    className="chart-value"
                    x={x + barW / 2}
                    y={y(day.rounds) - 5}
                    textAnchor="middle"
                  >
                    {day.rounds}
                  </text>
                )}
                {showLabel && (
                  <text className="chart-tick" x={x + barW / 2} y={height - 6} textAnchor="middle">
                    {short ? weekday.format(day.date) : new Date(day.date).getDate()}
                  </text>
                )}
                {/* Full-height hit target, larger than the bar itself. */}
                <rect
                  className="chart-hit"
                  x={pad.left + i * slot}
                  y={pad.top}
                  width={slot}
                  height={plotH}
                  onMouseMove={() =>
                    setTip({
                      x: x + barW / 2,
                      y: y(day.rounds) - 8,
                      content: (
                        <>
                          <strong>{full.format(day.date)}</strong>
                          <span>
                            {count(day.rounds, 'rounds')} · {formatMinutes(day.minutes)}
                          </span>
                        </>
                      )
                    })
                  }
                />
              </g>
            )
          })}
        </svg>
      )}
      <Tooltip tip={tip} />
      <table className="sr-only">
        <caption>{t('stats.daily')}</caption>
        <tbody>
          {days.map((day) => (
            <tr key={day.key}>
              <th scope="row">{full.format(day.date)}</th>
              <td>{count(day.rounds, 'rounds')}</td>
              <td>{formatMinutes(day.minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const HEAT_LEVELS = [0.22, 0.42, 0.68, 1]

function Heatmap({ grid }: { grid: number[][] }): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const formatMinutes = useFormatMinutes()
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)

  const labelW = 34
  const gap = 2
  const cell = Math.max(4, (width - labelW - gap * 23) / 24)
  const rowH = 14
  const max = Math.max(...grid.flat())
  // 2026-10-19 is a Monday; used only to get localized weekday names.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2026, 9, 19 + i))
  )
  const level = (v: number): number =>
    v <= 0 ? -1 : Math.min(3, Math.floor((v / max) * HEAT_LEVELS.length - 1e-9))

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={7 * (rowH + gap) + 18} role="img" aria-label={t('stats.byHour')}>
          {grid.map((row, d) => (
            <g key={d}>
              <text className="chart-tick" x={0} y={d * (rowH + gap) + rowH - 3}>
                {weekdays[d]}
              </text>
              {row.map((minutes, h) => {
                const lvl = level(minutes)
                const x = labelW + h * (cell + gap)
                const y = d * (rowH + gap)
                return (
                  <rect
                    key={h}
                    x={x}
                    y={y}
                    width={cell}
                    height={rowH}
                    rx={3}
                    className={lvl < 0 ? 'heat-empty' : 'heat-cell'}
                    style={lvl < 0 ? undefined : { opacity: HEAT_LEVELS[lvl] }}
                    onMouseMove={() =>
                      setTip({
                        x: x + cell / 2,
                        y: y - 4,
                        content: (
                          <>
                            <strong>
                              {weekdays[d]} {String(h).padStart(2, '0')}:00
                            </strong>
                            <span>{formatMinutes(minutes)}</span>
                          </>
                        )
                      })
                    }
                  />
                )
              })}
            </g>
          ))}
          {[0, 6, 12, 18].map((h) => (
            <text
              key={h}
              className="chart-tick"
              x={labelW + h * (cell + gap)}
              y={7 * (rowH + gap) + 12}
            >
              {String(h).padStart(2, '0')}
            </text>
          ))}
        </svg>
      )}
      <Tooltip tip={tip} />
      <div className="heat-legend" aria-hidden="true">
        <span>{t('stats.less')}</span>
        <span className="heat-swatch heat-empty-swatch" />
        {HEAT_LEVELS.map((o) => (
          <span key={o} className="heat-swatch" style={{ opacity: o }} />
        ))}
        <span>{t('stats.more')}</span>
      </div>
    </div>
  )
}

function TaskBars({ history, tasks }: { history: Session[]; tasks: Task[] }): React.JSX.Element {
  const t = useT()
  const formatMinutes = useFormatMinutes()
  const rows = timeByTask(history, tasks)
  const max = Math.max(...rows.map((r) => r.minutes))
  return (
    <ul className="task-bars">
      {rows.map((row) => (
        <li key={row.id ?? 'none'}>
          <div className="task-bar-head">
            <span className={`task-bar-name${row.title ? '' : ' muted'}`}>
              {row.id === 'other' ? t('stats.other') : (row.title ?? t('stats.noTask'))}
            </span>
            <span className="task-bar-value">{formatMinutes(row.minutes)}</span>
          </div>
          <div className="task-bar-track">
            <div className="task-bar-fill" style={{ width: `${(row.minutes / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Section({
  title,
  hint,
  action,
  children
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <section className="card chart-card">
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          {hint && <p className="chart-hint">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function StatsPage({ history, tasks, settings }: Props): React.JSX.Element {
  const t = useT()
  const count = useCount()
  const locale = useLocale()
  const formatMinutes = useFormatMinutes()
  const [range, setRange] = useState<7 | 30>(7)
  const summary = useMemo(() => summarize(history), [history])
  const days = useMemo(() => lastDays(history, range), [history, range])
  const grid = useMemo(() => hourHeatmap(history), [history])
  const hasData = history.some((s) => s.type === 'focus')
  const best = summary.bestDay

  return (
    <div className="stats-page">
      <GoalMeter done={summary.today.rounds} goal={settings.dailyGoal} />
      <div className="stat-grid">
        <StatTile
          label={t('stats.today')}
          value={count(summary.today.rounds, 'rounds')}
          sub={formatMinutes(summary.today.minutes)}
        />
        <StatTile
          label={t('stats.thisWeek')}
          value={count(summary.week.rounds, 'rounds')}
          sub={formatMinutes(summary.week.minutes)}
        />
        <StatTile label={t('stats.streak')} value={count(summary.streak, 'days')} />
        <StatTile
          label={t('stats.bestDay')}
          value={best ? count(best.rounds, 'rounds') : '–'}
          sub={
            best
              ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
                  best.date
                )
              : undefined
          }
        />
      </div>

      {!hasData ? (
        <p className="tasks-empty">{t('stats.empty')}</p>
      ) : (
        <>
          <Section
            title={t('stats.daily')}
            action={
              <div className="segmented" role="radiogroup">
                {([7, 30] as const).map((r) => (
                  <button
                    key={r}
                    role="radio"
                    aria-checked={range === r}
                    className={range === r ? 'selected' : ''}
                    onClick={() => setRange(r)}
                  >
                    {r === 7 ? t('stats.range7') : t('stats.range30')}
                  </button>
                ))}
              </div>
            }
          >
            <DailyChart days={days} goal={settings.dailyGoal} />
          </Section>
          <Section title={t('stats.byHour')} hint={t('stats.byHourHint')}>
            <Heatmap grid={grid} />
          </Section>
          <Section title={t('stats.byTask')}>
            <TaskBars history={history} tasks={tasks} />
          </Section>
        </>
      )}
    </div>
  )
}
