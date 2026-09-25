import { describe, expect, test } from 'bun:test'
import { EN_MESSAGES, VI_MESSAGES } from '../src/renderer/src/i18n/catalog'
import { resolveAppLocale } from '../src/renderer/src/i18n/locale'

describe('i18n foundation', () => {
  test('keeps English and Vietnamese catalogs key-compatible', () => {
    expect(Object.keys(VI_MESSAGES).sort()).toEqual(Object.keys(EN_MESSAGES).sort())
  })

  test('resolves explicit and system locales deterministically', () => {
    expect(resolveAppLocale('en', 'vi-VN')).toBe('en')
    expect(resolveAppLocale('vi', 'en-US')).toBe('vi')
    expect(resolveAppLocale('system', 'vi-VN')).toBe('vi')
    expect(resolveAppLocale('system', 'en-GB')).toBe('en')
    expect(resolveAppLocale('system', 'fr-FR')).toBe('en')
  })
})
