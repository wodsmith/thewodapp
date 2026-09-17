import { describe, it } from "vitest"

import { assertCrossAppParity } from "./support/cross-app-parity"

describe("cross-app parity harness", () => {
  it("runs reviewed fixtures through both app adapters after normalization", async () => {
    const fixtures = [
      { name: "accepted", input: 2, expected: { outcome: 4 } },
      { name: "boundary", input: 0, expected: { outcome: 0 } },
    ] as const

    await assertCrossAppParity<
      number,
      { result: number; app: string },
      { outcome: number }
    >({
      fixtures,
      adapters: [
        { name: "Crew", execute: (input) => ({ result: input * 2, app: "crew" }) },
        {
          name: "Start",
          execute: (input) => ({ result: input * 2, app: "wodsmith-start" }),
        },
      ],
      normalize: (output) => ({ outcome: output.result }),
    })
  })
})
