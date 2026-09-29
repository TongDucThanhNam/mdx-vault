let pending: Promise<typeof import('./GraphSurface')> | null = null

/** Idle warmup and an explicit open must await the same module evaluation. */
export function loadGraphSurface(): Promise<typeof import('./GraphSurface')> {
  pending ??= import('./GraphSurface').catch((error: unknown) => {
    pending = null
    throw error
  })
  return pending
}
