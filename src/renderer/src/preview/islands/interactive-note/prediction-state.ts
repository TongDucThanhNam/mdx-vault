export function commitPrediction(current: string | null, candidate: string): string {
  return current ?? candidate
}
