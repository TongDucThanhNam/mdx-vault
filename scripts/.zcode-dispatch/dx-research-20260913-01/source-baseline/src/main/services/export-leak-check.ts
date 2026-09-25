import { resolve } from 'path'

import type { VaultService } from './vault-service'

export interface LeakCheckOptions {
  vault: VaultService
  content: string
}

export interface LeakFinding {
  rule: string
  preview: string
}

const ABSOLUTE_PATH_PATTERNS: Array<{ rule: string; regex: RegExp }> = [
  { rule: 'windows-user-path', regex: /[A-Za-z]:\\Users\\/g },
  { rule: 'unix-home-path', regex: /\/Users\//g },
  { rule: 'unix-root-path', regex: /\/home\/[a-z0-9_-]+\//g },
  { rule: 'unix-root-home', regex: /\/root\//g }
]

const SECRET_PATTERNS: Array<{ rule: string; regex: RegExp }> = [
  { rule: 'openai-key', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { rule: 'openai-proj-key', regex: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g },
  { rule: 'anthropic-key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { rule: 'aws-access-key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { rule: 'github-token', regex: /\bghp_[A-Za-z0-9]{30,}\b/g },
  { rule: 'slack-token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { rule: 'google-api-key', regex: /\bAIza[0-9A-Za-z_-]{30,}\b/g }
]

const ENV_PATTERNS: Array<{ rule: string; regex: RegExp }> = [
  { rule: 'process-env', regex: /\bprocess\.env\.[A-Z_][A-Z0-9_]*\b/g },
  { rule: 'node-env-assignment', regex: /\bNODE_ENV\s*=\s*['"]?[A-Za-z]+/g }
]

const PREVIEW_LENGTH = 40

/**
 * Scan the export body for absolute filesystem paths, secret-shaped strings
 * (API keys / tokens) and accidental env-var references. The vault root path
 * itself is also rejected so a leaked `vault.rootPath` doesn't survive into
 * the published file.
 *
 * Findings are intentionally vague: callers must NOT echo the `preview`
 * back to the user unfiltered, since that would defeat the leak check. The
 * caller (renderer) only surfaces the rule names.
 */
export function scanForLeaks({ vault, content }: LeakCheckOptions): LeakFinding[] {
  const findings: LeakFinding[] = []

  const vaultRoot = normalizeForScan(vault.rootPath)
  if (vaultRoot && content.includes(vaultRoot)) {
    findings.push({
      rule: 'vault-root-path',
      preview: redactPreview(vaultRoot)
    })
  }

  // Also catch Windows-style vault path with mixed separators.
  if (vault.rootPath.includes('\\')) {
    const alt = vault.rootPath.replaceAll('\\', '\\\\')
    if (content.includes(alt)) {
      findings.push({
        rule: 'vault-root-path',
        preview: redactPreview(alt)
      })
    }
  }

  for (const { rule, regex } of ABSOLUTE_PATH_PATTERNS) {
    matchAll(content, regex).forEach((match) => {
      findings.push({ rule, preview: redactPreview(match) })
    })
  }

  for (const { rule, regex } of SECRET_PATTERNS) {
    matchAll(content, regex).forEach((match) => {
      findings.push({ rule, preview: redactPreview(match) })
    })
  }

  for (const { rule, regex } of ENV_PATTERNS) {
    matchAll(content, regex).forEach((match) => {
      findings.push({ rule, preview: redactPreview(match) })
    })
  }

  return dedupeFindings(findings)
}

function matchAll(content: string, regex: RegExp): string[] {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
  const globalRegex = new RegExp(regex.source, flags)
  const matches: string[] = []
  let match: RegExpExecArray | null

  while ((match = globalRegex.exec(content)) !== null) {
    matches.push(match[0])
    if (match.index === globalRegex.lastIndex) {
      globalRegex.lastIndex += 1
    }
  }

  return matches
}

function normalizeForScan(path: string): string {
  return resolve(path).replaceAll('\\', '/')
}

function redactPreview(value: string): string {
  if (value.length <= PREVIEW_LENGTH) {
    return value
  }
  return `${value.slice(0, PREVIEW_LENGTH)}…`
}

function dedupeFindings(findings: LeakFinding[]): LeakFinding[] {
  const seen = new Set<string>()
  const output: LeakFinding[] = []
  for (const finding of findings) {
    const key = `${finding.rule}::${finding.preview}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(finding)
  }
  return output
}
