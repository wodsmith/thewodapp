/** Three-way review operations stay local; they never mutate agent proposals. */
export function changedFields<T extends object>(
  before: T,
  after: T,
): (keyof T)[] {
  return (Object.keys(after) as (keyof T)[]).filter(
    (field) => !sameValue(before[field], after[field]),
  )
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

// @lat: [[workout-import-ux#Workout Import Workspace#Review and undo]]
export function applyReviewedFields<T extends object>(
  current: T,
  baseline: T,
  proposed: T,
  fields: (keyof T)[],
): { value: T; applied: (keyof T)[]; conflicts: (keyof T)[] } {
  const value = { ...current }
  const applied: (keyof T)[] = []
  const conflicts: (keyof T)[] = []
  for (const field of fields) {
    if (sameValue(current[field], proposed[field])) continue
    if (!sameValue(current[field], baseline[field])) {
      conflicts.push(field)
      continue
    }
    value[field] = proposed[field]
    applied.push(field)
  }
  return { value, applied, conflicts }
}

export type ReviewedApplication<T extends object> = {
  before: T
  after: T
  fields: (keyof T)[]
}

export function undoReviewedFields<T extends object>(
  current: T,
  application: ReviewedApplication<T>,
) {
  return applyReviewedFields(
    current,
    application.after,
    application.before,
    application.fields,
  )
}
