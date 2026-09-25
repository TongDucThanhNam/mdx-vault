import { describe, expect, test } from 'bun:test'
import { hostToSandboxMessageSchema } from '../src/shared/sandbox'

describe('host-to-sandbox messages', () => {
  test('validates an interactive init message', () => {
    expect(
      hostToSandboxMessageSchema.parse({
        channel: 'mdx-vault',
        instanceId: 'sandbox-1',
        type: 'init',
        props: { initial: 3 }
      })
    ).toEqual({
      channel: 'mdx-vault',
      instanceId: 'sandbox-1',
      type: 'init',
      props: { initial: 3 }
    })
  })

  test('validates both data response outcomes', () => {
    expect(
      hostToSandboxMessageSchema.safeParse({
        channel: 'mdx-vault',
        instanceId: 'sandbox-1',
        type: 'dataResponse',
        requestId: 'request-1',
        ok: true,
        data: 'dataset contents'
      }).success
    ).toBe(true)

    expect(
      hostToSandboxMessageSchema.safeParse({
        channel: 'mdx-vault',
        instanceId: 'sandbox-1',
        type: 'dataResponse',
        requestId: 'request-1',
        ok: false,
        error: 'Dataset unavailable'
      }).success
    ).toBe(true)
  })

  test('rejects malformed data responses', () => {
    expect(
      hostToSandboxMessageSchema.safeParse({
        channel: 'mdx-vault',
        instanceId: 'sandbox-1',
        type: 'dataResponse',
        requestId: 'request-1',
        ok: true,
        error: 'Wrong payload for a successful response'
      }).success
    ).toBe(false)
  })
})
