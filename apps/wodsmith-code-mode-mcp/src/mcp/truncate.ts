const DEFAULT_MAX_CHARS = 24_000

export function stringifyMcpResult(value: unknown): string {
  if (typeof value === "string") return value

  return JSON.stringify(
    value,
    (_key, innerValue) =>
      typeof innerValue === "bigint" ? innerValue.toString() : innerValue,
    2,
  )
}

export function truncateMcpText(
  text: string,
  maxChars = DEFAULT_MAX_CHARS,
): string {
  if (text.length <= maxChars) return text

  const omitted = text.length - maxChars
  return `${text.slice(0, maxChars)}\n\n[truncated ${omitted} characters; refine your search or return fewer fields]`
}
