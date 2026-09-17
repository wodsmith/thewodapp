import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

describe("shared operation drift manifest", () => {
  it("classifies every currently divergent Crew and Start peer", () => {
    const script = fileURLToPath(
      new URL("../scripts/check-drift.mjs", import.meta.url),
    )

    expect(() => execFileSync(process.execPath, [script])).not.toThrow()
  })
})
