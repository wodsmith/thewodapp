export type CompetitionEventAggregateSyncStatus =
  | "in-sync"
  | "behind"
  | "custom"
  | "unmapped"

export function deriveCompetitionEventSyncStatus({
  hasMappedDifferences,
  hasCustomEvents,
  mappedCount,
  totalTemplateEvents,
}: {
  hasMappedDifferences: boolean
  hasCustomEvents: boolean
  mappedCount: number
  totalTemplateEvents: number
}): CompetitionEventAggregateSyncStatus {
  if (hasMappedDifferences) {
    return "behind"
  }
  if (mappedCount < totalTemplateEvents) {
    return "unmapped"
  }
  if (hasCustomEvents) {
    return "custom"
  }
  return "in-sync"
}
