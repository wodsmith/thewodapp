/**
 * Renders JSON-LD structured data for search engines and AI answer engines.
 * Output is escaped to prevent script-breakout XSS from user-controlled fields.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const safeJson = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD escaped for safe embedding
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  )
}
