import { describe, expect, it } from "vitest"
import { generateInviteClaimTokenPlaintext } from "@/lib/competition-invites/tokens"

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
