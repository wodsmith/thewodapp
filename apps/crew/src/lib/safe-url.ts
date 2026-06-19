/**
 * Returns the URL only if it parses and uses an http(s) scheme.
 * Anything else (javascript:, data:, vbscript:, malformed) returns null
 * so it's safe to drop into href/src attributes.
 */
export function safeHttpUrl(input: string | null | undefined): string | null {
  if (!input) return null
  try {
    const url = new URL(input)
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString()
    }
    return null
  } catch {
    return null
  }
}
