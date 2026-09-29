/**
 * `AiDiffReview` — show what would change and ask for approval.
 *
 * Diff algorithm: simple LCS-based line diff. No external lib — the goal is
 * "honest preview", not pixel-perfect. The renderer asks the user to approve
 * before any write reaches the vault.
 */

import { Check, FileCode2, X } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface DiffReviewModel {
  before: string
  after: string
  fileLabel: string
}

interface AiDiffReviewProps {
  model: DiffReviewModel | null
  onApprove: () => void
  onReject: () => void
  busy?: boolean
}

export function AiDiffReview({
  model,
  onApprove,
  onReject,
  busy
}: AiDiffReviewProps): React.JSX.Element | null {
  const hunks = useMemo(() => (model ? buildLineDiff(model.before, model.after) : []), [model])
  const changed = hunks.some((line) => line.kind !== 'context')

  if (!model) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 border-t-2 border-foreground bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        <FileCode2 className="size-3.5" aria-hidden="true" />
        <span className="truncate font-bold text-foreground">{model.fileLabel}</span>
        <span className="ml-auto">{changed ? 'Changes pending review' : 'No textual changes'}</span>
      </div>

      <div className="max-h-64 overflow-auto border-2 border-foreground bg-background font-mono text-xs">
        {hunks.length === 0 ? (
          <div className="px-3 py-2 text-muted-foreground">Empty file.</div>
        ) : (
          hunks.map((line, index) => (
            <div
              key={index}
              className={cn(
                'flex gap-2 border-l-2 px-2 py-0.5',
                line.kind === 'add' &&
                  'border-l-[var(--success)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-foreground',
                line.kind === 'remove' && 'border-l-destructive bg-destructive/12 text-destructive',
                line.kind === 'context' && 'border-l-transparent'
              )}
            >
              <span className="w-4 shrink-0 select-none text-muted-foreground">
                {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' '}
              </span>
              <span className="whitespace-pre-wrap break-all">
                {line.text.length === 0 ? '\u00A0' : line.text}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onReject} disabled={busy}>
          <X className="size-4" aria-hidden="true" />
          Reject
        </Button>
        <Button type="button" size="sm" onClick={onApprove} disabled={busy || !changed}>
          <Check className="size-4" aria-hidden="true" />
          Approve &amp; write
        </Button>
      </div>
    </div>
  )
}

interface DiffLine {
  kind: 'context' | 'add' | 'remove'
  text: string
}

/* -------------------------------------------------------------------------- */
/*                                Line diff                                    */
/* -------------------------------------------------------------------------- */

function buildLineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const n = a.length
  const m = b.length

  // LCS via DP — fine for files of a few thousand lines.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'context', text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'remove', text: a[i] })
      i += 1
    } else {
      out.push({ kind: 'add', text: b[j] })
      j += 1
    }
  }

  while (i < n) {
    out.push({ kind: 'remove', text: a[i] })
    i += 1
  }

  while (j < m) {
    out.push({ kind: 'add', text: b[j] })
    j += 1
  }

  return out
}
