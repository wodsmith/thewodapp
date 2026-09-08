import { matchesLibraryOccurrence } from "@/lib/training/library-occurrence"
import type { PersonalTrainingItem, PersonalTrainingItemInput } from "@/lib/training/personal-types"

export function fixtureAdditionExists(previous: PersonalTrainingItem[], item: PersonalTrainingItemInput, allowDuplicate = false) {
 return previous.some(old => {
  if(old.id === item.id) return true
  if(allowDuplicate || old.kind !== item.kind) return false
  if(old.kind === "library" && item.kind === "library") return matchesLibraryOccurrence(old,item.workoutId,{trackId:item.sourceTrackId,sourceDate:item.sourceDate})
  return old.kind === "source" && item.kind === "source" && old.sourceSessionId === item.sourceSessionId && old.sourceBlockId === item.sourceBlockId && old.sourcePublishedVersion === item.sourcePublishedVersion
 })
}
