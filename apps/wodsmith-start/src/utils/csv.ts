/**
 * CSV utilities for client-side export generation.
 */

/**
 * Escape a cell value for safe inclusion in a CSV file.
 *
 * - Doubles existing double-quotes per RFC 4180.
 * - Prefixes formula-trigger characters (= + - @) with a single quote so
 *   spreadsheet apps don't evaluate the cell as a formula (CSV injection).
 *
 * The caller wraps the returned value in double-quotes.
 */
export function sanitizeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped
}

/**
 * Build a CSV string from a header row and data rows.
 * All cells are sanitized and wrapped in double-quotes.
 */
export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const quote = (v: unknown) => `"${sanitizeCsvCell(String(v ?? ""))}"`
  return [
    headers.map(quote).join(","),
    ...rows.map((row) => row.map(quote).join(",")),
  ].join("\n")
}

/**
 * Trigger a browser download of a CSV blob.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
