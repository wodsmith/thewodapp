import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/server/entitlements", () => ({
  hasFeature: vi.fn(),
}))

import { FEATURES } from "@/config/features"
import { assertBenchmarkCreationAccess } from "@/server/benchmark-creation-access"
import { hasFeature } from "@/server/entitlements"

describe("benchmark creation access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @lat: [[competition-type-capabilities#Benchmark Rollout Gates#Server Creation Entitlement]]
  it("rejects benchmark creation when the organizing team lacks access", async () => {
    vi.mocked(hasFeature).mockResolvedValue(false)

    await expect(
      assertBenchmarkCreationAccess({
        teamId: "team_without_access",
        competitionType: "benchmark",
      }),
    ).rejects.toThrow(
      "Your team does not have access to create benchmark competitions",
    )
    expect(hasFeature).toHaveBeenCalledWith(
      "team_without_access",
      FEATURES.CREATE_BENCHMARKS,
    )
  })

  it("allows entitled benchmark creation and leaves other types unchanged", async () => {
    vi.mocked(hasFeature).mockResolvedValue(true)

    await expect(
      assertBenchmarkCreationAccess({
        teamId: "team_with_access",
        competitionType: "benchmark",
      }),
    ).resolves.toBeUndefined()
    await expect(
      assertBenchmarkCreationAccess({
        teamId: "team_without_access",
        competitionType: "online",
      }),
    ).resolves.toBeUndefined()
    expect(hasFeature).toHaveBeenCalledTimes(1)
  })
})
