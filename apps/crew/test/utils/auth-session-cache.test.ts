import {beforeEach, describe, expect, it, vi} from 'vitest'

// Mock @tanstack/react-start/server so we can spy on getCookie calls.
// getCookie is the first thing computeSessionFromCookie calls — counting its
// invocations directly tells us whether the AsyncLocalStorage cache is doing
// its job.
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  getRequestHeaders: vi.fn(() => new Headers()),
}))

import {getCookie} from '@tanstack/react-start/server'
import {getSessionFromCookie, withSessionCache} from '@/utils/auth'

const mockedGetCookie = vi.mocked(getCookie)

describe('withSessionCache + getSessionFromCookie memoization', () => {
  beforeEach(() => {
    // Default: no session cookie → computeSessionFromCookie returns null
    // without touching KV. Sufficient to exercise the memoization layer.
    mockedGetCookie.mockReturnValue(undefined)
  })

  it('reuses a single underlying compute within one withSessionCache scope', async () => {
    await withSessionCache(async () => {
      await getSessionFromCookie()
      await getSessionFromCookie()
      await getSessionFromCookie()
    })

    expect(mockedGetCookie).toHaveBeenCalledTimes(1)
  })

  it('does not memoize when called outside withSessionCache', async () => {
    await getSessionFromCookie()
    await getSessionFromCookie()

    expect(mockedGetCookie).toHaveBeenCalledTimes(2)
  })

  it('isolates caches across separate withSessionCache scopes', async () => {
    await withSessionCache(async () => {
      await getSessionFromCookie()
    })
    await withSessionCache(async () => {
      await getSessionFromCookie()
    })

    expect(mockedGetCookie).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent calls within a scope (single in-flight promise)', async () => {
    await withSessionCache(async () => {
      await Promise.all([
        getSessionFromCookie(),
        getSessionFromCookie(),
        getSessionFromCookie(),
        getSessionFromCookie(),
      ])
    })

    expect(mockedGetCookie).toHaveBeenCalledTimes(1)
  })

  it('returns the same resolved value to every caller in the scope', async () => {
    let value1: unknown
    let value2: unknown

    await withSessionCache(async () => {
      value1 = await getSessionFromCookie()
      value2 = await getSessionFromCookie()
    })

    expect(value1).toBeNull()
    expect(value2).toBeNull()
    expect(value1).toBe(value2)
  })

  it('does not bleed cached value into a sibling scope', async () => {
    let firstScopeValue: unknown
    let secondScopeValue: unknown

    await withSessionCache(async () => {
      firstScopeValue = await getSessionFromCookie()
    })

    // Change the cookie before entering a new scope — the new scope must
    // re-read it rather than using the prior scope's cached null.
    mockedGetCookie.mockReturnValueOnce('user-123:tok-abc')
    // Even with a "valid" cookie shape, decoding/validating goes through
    // the rest of the auth pipeline, which in tests will still resolve to
    // null because KV is mocked empty. The point of this assertion is the
    // call count, not the value.
    await withSessionCache(async () => {
      secondScopeValue = await getSessionFromCookie()
    })

    expect(firstScopeValue).toBeNull()
    expect(secondScopeValue).toBeNull()
    // 2 = once per scope; never reused across scopes
    expect(mockedGetCookie).toHaveBeenCalledTimes(2)
  })

  it('caches the rejected promise so a transient error does not retry within scope', async () => {
    mockedGetCookie.mockImplementation(() => {
      throw new Error('cookie-store-unavailable')
    })

    await withSessionCache(async () => {
      await expect(getSessionFromCookie()).rejects.toThrow(
        'cookie-store-unavailable',
      )
      await expect(getSessionFromCookie()).rejects.toThrow(
        'cookie-store-unavailable',
      )
    })

    // The rejection is cached — a single underlying compute, not two.
    expect(mockedGetCookie).toHaveBeenCalledTimes(1)
  })

  it('supports nesting: inner withSessionCache shadows the outer cache', async () => {
    await withSessionCache(async () => {
      await getSessionFromCookie()
      await withSessionCache(async () => {
        await getSessionFromCookie()
      })
      await getSessionFromCookie()
    })

    // Outer scope: 1 compute (call 1 + call 3 share). Inner scope: 1 compute.
    // Total: 2.
    expect(mockedGetCookie).toHaveBeenCalledTimes(2)
  })
})
