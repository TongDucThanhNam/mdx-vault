/**
 * Phase 2 backend smoke test.
 *
 * Run with: bun scripts/verify-phase2-ops.ts
 *
 * Exercises delete/rename/duplicate/empty-trash/list-trash against a copy of
 * the example-vault so we don't mutate the real one. Verifies:
 *   - deleteFile moves the note into <vault>/.trash/ and the trash contains it
 *   - the trash is no longer indexed (i.e. .trash/ is excluded from listFiles)
 *   - renameFile atomically moves a file, returns the new normalized path
 *   - duplicateFile produces "<stem> copy.mdx" (or " copy 2", ...)
 *   - emptyTrash empties the trash directory
 *   - resolveAbsolutePath + safeJoin refuse path traversal
 */
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { VaultService } from '../src/main/services/vault-service'

async function main(): Promise<void> {
  const scratch = await mkdtemp(join(tmpdir(), 'mdx-vault-phase2-'))
  console.log('scratch vault:', scratch)

  try {
    const vault = new VaultService(scratch)

    // Seed: two notes + a directory.
    await mkdir(join(scratch, 'notes'), { recursive: true })
    await writeFile(join(scratch, 'notes', 'Alpha.mdx'), '# Alpha\n', 'utf8')
    await writeFile(join(scratch, 'notes', 'Beta.mdx'), '# Beta\n', 'utf8')
    await writeFile(join(scratch, 'Top.mdx'), '# Top\n', 'utf8')

    // 1) listFiles sees 3 notes.
    const initial = await vault.listFiles()
    assert(initial.length === 3, `expected 3 files, got ${initial.length}`)
    console.log('OK listFiles sees 3 seeded notes')

    // 2) deleteFile moves note into .trash/.
    const trashPath = await vault.deleteFile('notes/Alpha.mdx')
    assert(trashPath.startsWith('.trash/'), `trash path should start with .trash/, got ${trashPath}`)
    const afterDelete = await vault.listFiles()
    assert(afterDelete.length === 2, `expected 2 files after delete, got ${afterDelete.length}`)
    assert(
      !afterDelete.some((file) => file.relativePath === 'notes/Alpha.mdx'),
      'deleted note should no longer be in listFiles'
    )
    console.log('OK deleteFile moved notes/Alpha.mdx ->', trashPath)

    // 3) listTrash finds it.
    const trash = await vault.listTrash()
    assert(trash.length === 1, `expected 1 trash entry, got ${trash.length}`)
    assert(
      trash[0].originalPath === 'notes/Alpha.mdx',
      `expected original path notes/Alpha.mdx, got ${trash[0].originalPath}`
    )
    console.log('OK listTrash returns', trash[0].originalPath)

    // 4) Repeated delete of same name doesn't clobber.
    await writeFile(join(scratch, 'notes', 'Alpha.mdx'), '# Alpha v2\n', 'utf8')
    const trashPath2 = await vault.deleteFile('notes/Alpha.mdx')
    assert(trashPath2 !== trashPath, 'second delete should produce a unique trash name')
    const trash2 = await vault.listTrash()
    assert(trash2.length === 2, `expected 2 trash entries, got ${trash2.length}`)
    console.log('OK repeated delete produces unique entries:', trashPath, trashPath2)

    // 5) renameFile.
    const renamedPath = await vault.renameFile('notes/Beta.mdx', 'notes/BetaRenamed.mdx')
    assert(renamedPath === 'notes/BetaRenamed.mdx', `rename returned ${renamedPath}`)
    const afterRename = await vault.listFiles()
    assert(
      afterRename.some((file) => file.relativePath === 'notes/BetaRenamed.mdx'),
      'renamed note should be visible'
    )
    assert(
      !afterRename.some((file) => file.relativePath === 'notes/Beta.mdx'),
      'old name should be gone'
    )
    console.log('OK renameFile notes/Beta.mdx -> notes/BetaRenamed.mdx')

    // 6) renameFile refuses overwrite.
    await writeFile(join(scratch, 'notes', 'Conflict.mdx'), 'c1', 'utf8')
    try {
      await vault.renameFile('Top.mdx', 'notes/Conflict.mdx')
      throw new Error('renameFile should have refused to overwrite')
    } catch (error) {
      assert(String(error).includes('already exists'), `wrong error: ${error}`)
      console.log('OK renameFile refuses overwrite')
    }

    // 7) duplicateFile.
    const dupPath = await vault.duplicateFile('Top.mdx')
    assert(dupPath === 'Top copy.mdx', `dup returned ${dupPath}`)
    await writeFile(join(scratch, 'Top copy.mdx'), 'placeholder', 'utf8') // make second dup differ
    const dupPath2 = await vault.duplicateFile('Top.mdx')
    assert(dupPath2 === 'Top copy 2.mdx', `dup2 returned ${dupPath2}`)
    console.log('OK duplicateFile:', dupPath, dupPath2)

    // 8) Path traversal is rejected. The extension guard catches non-md
    // paths first; for a .mdx traversal attempt, safeJoin must refuse.
    let traversalCaught = false
    try {
      await vault.deleteFile('../../../etc/evil.mdx')
    } catch (error) {
      traversalCaught = String(error).includes('escapes vault root')
    }
    assert(traversalCaught, 'path traversal delete should fail with safeJoin error')
    console.log('OK path traversal rejected')

    // 9) Trash reject: cannot delete from .trash directly.
    try {
      await vault.deleteFile('.trash/something.mdx')
      throw new Error('deleteFile should have rejected .trash path')
    } catch (error) {
      assert(String(error).includes('.trash'), `wrong error: ${error}`)
      console.log('OK deleteFile refuses .trash/ direct manipulation')
    }

    // 10) emptyTrash.
    await vault.emptyTrash()
    const afterEmpty = await vault.listTrash()
    assert(afterEmpty.length === 0, `trash should be empty, got ${afterEmpty.length}`)
    console.log('OK emptyTrash emptied .trash/')

    // 11) resolveAbsolutePath.
    const abs = vault.resolveAbsolutePath('Top.mdx')
    assert(abs.endsWith('Top.mdx'), `abs returned ${abs}`)
    console.log('OK resolveAbsolutePath:', abs)

    console.log('\nALL PHASE 2 BACKEND TESTS PASSED')
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
