import { mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { VaultService } from '../src/main/services/vault-service'

async function main(): Promise<void> {
  const scratch = await mkdtemp(join(tmpdir(), 'mdx-vault-p3-'))
  console.log('scratch vault:', scratch)

  try {
    const vault = new VaultService(scratch)

    // 1) Save an asset with a clean name.
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const relPath = await vault.saveAsset('my screenshot.png', pngBytes)
    if (relPath !== 'assets/my-screenshot.png') {
      throw new Error(`expected assets/my-screenshot.png, got ${relPath}`)
    }
    console.log('OK saveAsset normalized:', relPath)

    // 2) File exists and content matches.
    const bytes = await readFile(join(scratch, relPath))
    if (bytes.length !== 8 || bytes[0] !== 0x89) {
      throw new Error('saved asset content mismatch')
    }
    console.log('OK saveAsset wrote correct bytes')

    // 3) Repeated save with same name doesn't clobber.
    const relPath2 = await vault.saveAsset('my screenshot.png', pngBytes)
    if (relPath2 !== 'assets/my-screenshot-1.png') {
      throw new Error(`expected assets/my-screenshot-1.png, got ${relPath2}`)
    }
    console.log('OK saveAsset uniquified:', relPath2)

    // 4) Illegal extension rejected.
    let extReject = false
    try {
      await vault.saveAsset('evil.exe', pngBytes)
    } catch (error) {
      extReject = String(error).includes('Unsupported asset extension')
    }
    if (!extReject) {
      throw new Error('expected extension rejection')
    }
    console.log('OK saveAsset rejects non-image extension')

    // 5) Path traversal in name is sanitized (basename only — `../../etc/`
    // is stripped, leaving just `passwd.png`).
    const relPath3 = await vault.saveAsset('../../etc/passwd.png', pngBytes)
    if (relPath3 !== 'assets/passwd.png') {
      throw new Error(`expected assets/passwd.png, got ${relPath3}`)
    }
    console.log('OK saveAsset sanitizes path traversal:', relPath3)

    // 6) Empty stem (all-illegal chars) falls back to image-<timestamp>.
    const relPath4 = await vault.saveAsset('<>*?.png', pngBytes)
    if (!relPath4.startsWith('assets/image-') || !relPath4.endsWith('.png')) {
      throw new Error(`expected fallback image-<ts>.png, got ${relPath4}`)
    }
    console.log('OK saveAsset falls back for empty stem:', relPath4)

    console.log('\nALL PHASE 3 ASSET TESTS PASSED')
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
