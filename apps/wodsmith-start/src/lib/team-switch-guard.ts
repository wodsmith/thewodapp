const eventName = "wodsmith:before-team-switch"
type TeamSwitchEvent = CustomEvent<Promise<boolean>[]>

/** Ask mounted editors before changing the active-team cookie. */
export async function requestTeamSwitch(): Promise<boolean> {
  const decisions: Promise<boolean>[] = []
  window.dispatchEvent(new CustomEvent(eventName, { detail: decisions }))
  return (await Promise.all(decisions)).every(Boolean)
}

export function registerTeamSwitchGuard(
  guard: () => boolean | Promise<boolean>,
): () => void {
  const listener = (event: Event) => {
    const request = event as TeamSwitchEvent
    request.detail.push(Promise.resolve().then(guard))
  }
  window.addEventListener(eventName, listener)
  return () => window.removeEventListener(eventName, listener)
}
