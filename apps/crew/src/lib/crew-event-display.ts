// @lat: [[crew#Event Setup Dashboard]]
export function formatCrewValue(value: string) {
  return value.replaceAll("_", " ")
}

// @lat: [[crew#Event Setup Dashboard]]
export function getSafeHttpUrl(value: string | null | undefined) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}
