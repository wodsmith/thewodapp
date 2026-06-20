// @lat: [[crew#Assignment Confirmations]]
export function getCrewAssignmentConfirmationStatusBadgeClassName(
  status: string,
) {
  if (status === "missing") {
    return "border-amber-500/30 bg-background text-amber-700"
  }
  if (status === "pending") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  }
  if (status === "sent") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-700"
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
  if (status === "replaced") {
    return "border-muted bg-muted text-muted-foreground"
  }
  if (status === "no_show") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-700"
  }
  return "border-muted bg-background text-muted-foreground"
}

export function getCrewAssignmentConfirmationStatusLabel(status: string) {
  if (status === "change_requested") return "Change requested"
  if (status === "no_show") return "No-show"
  if (status === "cancelled" || status === "replaced") return "Replaced"
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
