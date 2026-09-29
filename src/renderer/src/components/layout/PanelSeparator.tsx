import { type RefObject, useEffect, useRef } from 'react'
import {
  normalizePanelWidth,
  PANEL_WIDTH_RANGES,
  type PanelWidthKey
} from '../../../../shared/app-settings'
import { reducePanelResizeKey } from './panel-resize'

const LABELS: Record<PanelWidthKey, string> = {
  leftPanelWidth: 'Resize explorer panel',
  rightPanelWidth: 'Resize context panel',
  aiPanelWidth: 'Resize assistant panel'
}

export function PanelSeparator({
  panel,
  width,
  gridRef,
  onCommit,
  documentFloor = 30
}: {
  panel: PanelWidthKey
  width: number
  gridRef: RefObject<HTMLElement | null>
  onCommit: (key: PanelWidthKey, width: number) => void
  documentFloor?: number
}): React.JSX.Element {
  const current = useRef(width)
  const frame = useRef<number | null>(null)
  const start = useRef<{ x: number; width: number; max: number; rem: number } | null>(null)
  const variable = `--${panel.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`

  const availableMax = (): number => {
    const grid = gridRef.current
    if (!grid) return PANEL_WIDTH_RANGES[panel].max
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const other = (['leftPanelWidth', 'rightPanelWidth', 'aiPanelWidth'] as const)
      .filter((key) => key !== panel)
      .reduce(
        (sum, key) =>
          sum + (grid.querySelector<HTMLElement>(`[data-panel-width="${key}"]`)?.offsetWidth ?? 0),
        0
      )
    const separators = grid.querySelectorAll('[role="separator"]').length * 6
    return Math.max(
      PANEL_WIDTH_RANGES[panel].min,
      Math.min(
        PANEL_WIDTH_RANGES[panel].max,
        (grid.clientWidth - documentFloor * rem - other - separators) / rem
      )
    )
  }

  useEffect(() => {
    current.current = width
    gridRef.current?.style.setProperty(variable, `${width}rem`)
  }, [gridRef, variable, width])

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      document.body.style.cursor = ''
    },
    []
  )

  const write = (value: number): void => {
    current.current = value
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      gridRef.current?.style.setProperty(variable, `${value}rem`)
      frame.current = null
    })
  }

  const finish = (pointerId: number, target: HTMLDivElement): void => {
    if (!start.current) return
    start.current = null
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
    target.setAttribute('aria-valuenow', String(current.current))
    document.body.style.cursor = ''
    onCommit(panel, current.current)
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={LABELS[panel]}
      aria-orientation="vertical"
      aria-valuemin={PANEL_WIDTH_RANGES[panel].min}
      aria-valuemax={PANEL_WIDTH_RANGES[panel].max}
      aria-valuenow={width}
      className="group relative z-10 min-w-[6px] cursor-col-resize outline-none touch-none before:absolute before:inset-y-0 before:left-[2px] before:w-px before:bg-border hover:before:bg-[var(--instrument-blue)] focus-visible:before:bg-[var(--instrument-blue)] focus-visible:before:w-[2px]"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        start.current = {
          x: event.clientX,
          width: current.current,
          rem,
          max: availableMax()
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        document.body.style.cursor = 'col-resize'
        event.preventDefault()
      }}
      onPointerMove={(event) => {
        if (!start.current) return
        const direction = panel === 'leftPanelWidth' ? 1 : -1
        const desired =
          start.current.width + ((event.clientX - start.current.x) / start.current.rem) * direction
        write(Math.min(start.current.max, normalizePanelWidth(panel, desired)))
      }}
      onPointerUp={(event) => finish(event.pointerId, event.currentTarget)}
      onPointerCancel={(event) => finish(event.pointerId, event.currentTarget)}
      onDoubleClick={(event) => {
        const fitted = Math.min(PANEL_WIDTH_RANGES[panel].defaultValue, availableMax())
        write(fitted)
        event.currentTarget.setAttribute('aria-valuenow', String(fitted))
        onCommit(panel, fitted)
      }}
      onKeyDown={(event) => {
        const next = reducePanelResizeKey(panel, current.current, event.key, event.shiftKey)
        if (next === null) return
        event.preventDefault()
        const fitted = Math.min(next, availableMax())
        write(fitted)
        event.currentTarget.setAttribute('aria-valuenow', String(fitted))
        onCommit(panel, fitted)
      }}
    />
  )
}
