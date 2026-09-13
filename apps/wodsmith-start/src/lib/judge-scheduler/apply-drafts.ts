/** Persist first; acknowledgement and refresh failures cannot undo saved drafts. */
export async function applyJudgeDrafts({
  save,
  acknowledge,
  refresh,
}: {
  save: () => Promise<{ appliedCount: number }>
  acknowledge: () => Promise<unknown>
  refresh: () => Promise<unknown>
}) {
  const result = await save()
  let acknowledged = true
  let refreshed = true
  try {
    await acknowledge()
  } catch {
    acknowledged = false
  }
  try {
    await refresh()
  } catch {
    refreshed = false
  }
  return { ...result, acknowledged, refreshed }
}
