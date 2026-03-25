import { createFileRoute } from "@tanstack/react-router"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const Route = createFileRoute("/api/sitemap")({
  server: {
    handlers: {
      GET: async () => {
        const db = getDb()

        const competitions = await db
          .select({
            slug: competitionsTable.slug,
            updatedAt: competitionsTable.updatedAt,
          })
          .from(competitionsTable)
          .where(
            and(
              eq(competitionsTable.visibility, "public"),
              eq(competitionsTable.status, "published"),
            ),
          )

        const baseUrl = "https://wodsmith.com"

        const staticPages = [
          { url: "/", priority: "1.0", changefreq: "weekly" },
          { url: "/compete", priority: "0.9", changefreq: "daily" },
          { url: "/terms", priority: "0.2", changefreq: "yearly" },
          { url: "/privacy", priority: "0.2", changefreq: "yearly" },
        ]

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join("\n")}
${competitions
  .map(
    (comp) => `  <url>
    <loc>${baseUrl}/compete/${comp.slug}</loc>
    <lastmod>${comp.updatedAt ? new Date(comp.updatedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/compete/${comp.slug}/leaderboard</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        })
      },
    },
  },
})
