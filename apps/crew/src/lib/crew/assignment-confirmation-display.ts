export function getCrewAssignmentConfirmationStatusBadgeClassName(
  status: string,
) {
  if (status === "pending") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  }
  if (status === "confirmed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  }
  if (status === "declined") {
    return "border-destructive/30 bg-destructive/10 text-destructive"
  }
  if (status === "change_requested") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700"
  }
  if (status === "cancelled") {
    return "border-muted bg-muted text-muted-foreground"
  }
  if (status === "no_show") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-700"
  }
  return "border-muted bg-background text-muted-foreground"
}
