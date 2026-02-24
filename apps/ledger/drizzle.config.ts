import fs from "node:fs"
import path from "node:path"
import { defineConfig } from "drizzle-kit"

function getLocalD1DB() {
	const possiblePaths = [
		".alchemy/local/.wrangler/state/v3/d1",
		".wrangler/state/v3/d1",
	]

	for (const basePath of possiblePaths) {
		try {
			const resolvedPath = path.resolve(basePath)
			const dbFile = fs
				.readdirSync(resolvedPath, { encoding: "utf-8", recursive: true })
				.find((f) => f.endsWith(".sqlite"))

			if (dbFile) {
				const url = path.resolve(resolvedPath, dbFile)
				console.log(`Using D1 database: ${url}`)
				return url
			}
		} catch {
			// Directory doesn't exist, try next path
		}
	}

	console.error("No local D1 database found. Run 'pnpm alchemy:dev' first.")
	return null
}

export default defineConfig({
	out: "./src/db/migrations",
	schema: "./src/db/schema.ts",
	dialect: "sqlite",
	...(process.env.NODE_ENV === "production"
		? {
				driver: "d1-http",
				dbCredentials: {
					accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
					databaseId: process.env.DATABASE_ID,
					token: process.env.CLOUDFLARE_API_TOKEN,
				},
			}
		: {
				dbCredentials: {
					url: getLocalD1DB(),
				},
			}),
})
