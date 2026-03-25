/**
 * Renders JSON-LD structured data for search engines and AI answer engines.
 * Data must come from trusted sources (database/server) — not raw user input.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from trusted server data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
