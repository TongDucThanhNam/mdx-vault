/**
 * Verify GOAL-07 Success Criteria end-to-end by running the export service
 * directly (no Electron). Outputs:
 *   - example-vault/exports/Welcome.static.html
 *   - example-vault/exports/Welcome.interactive.html
 *   - example-vault/exports/React Interactive Demo.interactive.html
 *   - example-vault/exports/SandboxedHTML Demo.interactive.html
 *
 * Run with: bun scripts/verify-export.ts
 */
import { mkdir, rm } from 'fs/promises'
import { resolve } from 'path'

import { VaultService } from '../src/main/services/vault-service'
import { SandboxService } from '../src/main/services/sandbox-service'
import { ExportService } from '../src/main/services/export-service'
import { SandboxExportBridge } from '../src/main/services/export-sandbox-bridge'

const VAULT_ROOT = resolve(process.cwd(), 'example-vault')
const OUT_DIR = resolve(VAULT_ROOT, 'exports')

async function ensureOutDir(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })
}

function bindBridge(vault: VaultService): SandboxExportBridge {
  const sandboxService = new SandboxService(vault)
  return new SandboxExportBridge(sandboxService)
}

async function runOne(
  service: ExportService,
  noteRelativePath: string,
  mode: 'static' | 'interactive',
  outAbsolute: string
): Promise<{ size: number; warnings: string[] }> {
  const events: string[] = []
  const result = await service.run(
    {
      noteRelativePath,
      mode,
      target: { absolutePath: outAbsolute },
      confirmedOversized: true
    },
    (event) => {
      events.push(event.phase)
    }
  )
  console.log(`[${mode}] ${noteRelativePath} → ${outAbsolute} (${result.size} bytes)`)
  console.log(`  phases: ${[...new Set(events)].join(', ')}`)
  if (result.warnings.length > 0) {
    console.log(`  warnings:`)
    for (const w of result.warnings) console.log(`    - ${w}`)
  }
  return result
}

async function main(): Promise<void> {
  await ensureOutDir()
  const vault = new VaultService(VAULT_ROOT)
  const bridge = bindBridge(vault)
  const service = new ExportService(vault, bridge)

  const targets: Array<{ note: string; mode: 'static' | 'interactive'; out: string }> = [
    { note: 'notes/Welcome.mdx', mode: 'static', out: resolve(OUT_DIR, 'Welcome.static.html') },
    {
      note: 'notes/Welcome.mdx',
      mode: 'interactive',
      out: resolve(OUT_DIR, 'Welcome.interactive.html')
    },
    {
      note: 'notes/React Interactive Demo.mdx',
      mode: 'interactive',
      out: resolve(OUT_DIR, 'React Interactive Demo.interactive.html')
    },
    {
      note: 'notes/SandboxedHTML Demo.mdx',
      mode: 'interactive',
      out: resolve(OUT_DIR, 'SandboxedHTML Demo.interactive.html')
    }
  ]

  for (const target of targets) {
    await runOne(service, target.note, target.mode, target.out)
  }

  console.log('\nAll exports written to:', OUT_DIR)
}

main().catch((error) => {
  console.error('verify-export failed:', error)
  process.exit(1)
})
