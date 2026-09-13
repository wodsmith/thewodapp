import { matchesLibraryOccurrence } from "@/lib/training/library-occurrence"
import type {
  PersonalTrainingItem,
  PersonalTrainingItemInput,
} from "@/lib/training/personal-types"
import { personalTrainingItemSchema } from "@/server/training-personal-validation"

export function fixtureAdditionExists(
  previous: PersonalTrainingItem[],
  item: PersonalTrainingItemInput,
  allowDuplicate = false,
) {
  return previous.some((old) => {
    const samePayload =
      old.kind === "library" && item.kind === "library"
        ? matchesLibraryOccurrence(old, item.workoutId, {
            trackId: item.sourceTrackId,
            sourceDate: item.sourceDate,
          })
        : old.kind === "source" && item.kind === "source"
          ? old.sourceSessionId === item.sourceSessionId &&
            old.sourceBlockId === item.sourceBlockId &&
            old.sourcePublishedVersion === item.sourcePublishedVersion
          : old.kind === "personal" &&
            item.kind === "personal" &&
            JSON.stringify(personalTrainingItemSchema.parse(old)) ===
              JSON.stringify(personalTrainingItemSchema.parse(item))
    if (old.id === item.id) {
      if (!samePayload)
        throw new Error(
          "CONFLICT: This addition belongs to a different workout",
        )
      return true
    }
    return !allowDuplicate && samePayload
  })
}
