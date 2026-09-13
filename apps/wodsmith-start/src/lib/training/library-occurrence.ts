import type { ProviderProvenance } from "./personal-types"

export interface LibraryOccurrence {
  trackId?: string
  sourceDate?: string
}

/** Missing metadata denotes legacy snapshots; an explicit empty object is unscoped. */
export function libraryOccurrence(item: {
  occurrence?: LibraryOccurrence
  provenance?: ProviderProvenance
}): LibraryOccurrence {
  return (
    item.occurrence ??
    (item.provenance
      ? {
          trackId: item.provenance.trackId,
          sourceDate: item.provenance.sourceDate,
        }
      : {})
  )
}

export function matchesLibraryOccurrence(
  item: {
    workoutId?: string
    occurrence?: LibraryOccurrence
    provenance?: ProviderProvenance
  },
  workoutId: string,
  target: LibraryOccurrence,
): boolean {
  const occurrence = libraryOccurrence(item)
  return (
    item.workoutId === workoutId &&
    occurrence.trackId === target.trackId &&
    occurrence.sourceDate === target.sourceDate
  )
}
