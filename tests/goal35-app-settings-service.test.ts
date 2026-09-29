import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { AppSettingsService } from '../src/main/services/app-settings'

describe('GOAL-35 persisted appearance and panel preferences', () => {
  test('migrates defaults and round-trips validated additive fields', async () => {
    const root = await mkdtemp(join(tmpdir(), 'goal35-settings-'))
    expect(resolve(root).startsWith(`${resolve(tmpdir())}${sep}`)).toBe(true)
    try {
      const service = new AppSettingsService(root)
      expect(await service.getSettings()).toMatchObject({
        readingPaper: 'follow-theme',
        leftPanelWidth: 15.5,
        rightPanelWidth: 18,
        aiPanelWidth: 21
      })
      await service.updateSettings({
        readingPaper: 'light',
        leftPanelWidth: 22,
        rightPanelWidth: 24,
        aiPanelWidth: 28
      })
      const reloaded = await new AppSettingsService(root).getSettings()
      expect(reloaded).toMatchObject({
        readingPaper: 'light',
        leftPanelWidth: 22,
        rightPanelWidth: 24,
        aiPanelWidth: 28
      })
      expect(await readFile(join(root, 'app-settings.json'), 'utf8')).toContain(
        '"readingPaper": "light"'
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
