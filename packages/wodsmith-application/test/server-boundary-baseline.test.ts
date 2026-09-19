import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

describe("shared application boundaries", () => {
  it("rejects new route-safe and client-safe server imports", () => {
    const script = fileURLToPath(
      new URL("../scripts/check-boundaries.mjs", import.meta.url),
    )

    expect(() => execFileSync(process.execPath, [script])).not.toThrow()
  })
})
