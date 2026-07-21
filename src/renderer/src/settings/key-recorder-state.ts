export interface KeyRecorderConflictState {
  readonly conflicts: readonly unknown[]
}

/** Only the chord-listening phase owns every global key event. */
export function isKeyRecorderCapturing(state: KeyRecorderConflictState | null): boolean {
  return state !== null && state.conflicts.length === 0
}
