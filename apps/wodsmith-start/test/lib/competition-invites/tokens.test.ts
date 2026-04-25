import { describe, expect, it } from "vitest"
import {
  generateInviteClaimToken,
  generateInviteClaimTokenPlaintext,
  hashInviteClaimToken,
  inviteClaimTokenLast4,
} from "@/lib/competition-invites/tokens"

describe("hashInviteClaimToken", () => {
  it("is deterministic — same input yields same hash", async () => {
    const a = await hashInviteClaimToken("abc123")
    const b = await hashInviteClaimToken("abc123")
    expect(a).toBe(b)
  })

  it("differs for different inputs", async () => {
    const a = await hashInviteClaimToken("abc123")
    const b = await hashInviteClaimToken("abc124")
    expect(a).not.toBe(b)
  })

  it("returns 64 lowercase hex chars (SHA-256)", async () => {
    const hash = await hashInviteClaimToken("hello")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("matches a known SHA-256 of 'hello'", async () => {
    expect(await hashInviteClaimToken("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    )
  })
})

describe("generateInviteClaimTokenPlaintext", () => {
  it("emits URL-safe characters only (unpadded base64url)", () => {
    const token = generateInviteClaimTokenPlaintext()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token).not.toContain("=")
  })

  it("is long enough to encode 32 random bytes", () => {
    const token = generateInviteClaimTokenPlaintext()
    // 32 bytes → ceil(32*8/6) = 43 unpadded base64url characters.
    expect(token.length).toBe(43)
  })

  it("produces unique values across a 1000-generation sample", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      seen.add(generateInviteClaimTokenPlaintext())
    }
    expect(seen.size).toBe(1000)
  })
})

describe("inviteClaimTokenLast4", () => {
  it("returns the last 4 characters", () => {
    expect(inviteClaimTokenLast4("abcdefg")).toBe("defg")
  })

  it("is idempotent for short tokens", () => {
    expect(inviteClaimTokenLast4("ab")).toBe("ab")
  })
})

describe("generateInviteClaimToken", () => {
  it("returns plaintext + hash + last4 derived from the same token", async () => {
    const { token, hash, last4 } = await generateInviteClaimToken()
    expect(last4).toBe(token.slice(-4))
    expect(hash).toBe(await hashInviteClaimToken(token))
  })
})
