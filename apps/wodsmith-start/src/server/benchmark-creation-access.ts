import { FEATURES } from "@/config/features"
import type { CompetitionTypeId } from "@/lib/competitions/capabilities"
import { hasFeature } from "@/server/entitlements"

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
    throw new Error(
      "Your team does not have access to create benchmark competitions",
    )
  }
}
