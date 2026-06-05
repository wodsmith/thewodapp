import type { Waiver } from "@/db/schemas/waivers"

export function haveAllVolunteerWaiversBeenAgreed(
  waivers: Waiver[],
  agreedWaiverIds: Set<string>,
): boolean {
  return waivers.every((waiver) => agreedWaiverIds.has(waiver.id))
}

export function toggleVolunteerWaiverAgreement(
  agreedWaiverIds: Set<string>,
  waiverId: string,
  checked: boolean,
): Set<string> {
  const next = new Set(agreedWaiverIds)
  if (checked) {
    next.add(waiverId)
  } else {
    next.delete(waiverId)
  }
  return next
}
