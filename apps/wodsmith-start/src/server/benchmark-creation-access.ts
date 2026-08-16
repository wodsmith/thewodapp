import { FEATURES } from "@/config/features"
import type { CompetitionTypeId } from "@/lib/competitions/capabilities"
import { hasFeature } from "@/server/entitlements"
import { AppError } from "@/utils/errors"

// @lat: [[competition-type-capabilities#Benchmark Rollout Gates]]
export async function assertBenchmarkCreationAccess({
  teamId,
  competitionType,
}: {
  teamId: string
  competitionType: CompetitionTypeId | undefined
}): Promise<void> {
  if (competitionType !== "benchmark") return

  const canCreateBenchmarks = await hasFeature(
    teamId,
    FEATURES.CREATE_BENCHMARKS,
  )
  if (!canCreateBenchmarks) {
    throw new AppError(
      "FORBIDDEN",
      "Your team does not have access to create benchmark competitions",
    )
  }
}
