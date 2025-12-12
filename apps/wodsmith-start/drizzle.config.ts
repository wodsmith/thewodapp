import fs from "node:fs"
import path from "node:path"
import { defineConfig } from "drizzle-kit"

function getLocalD1DB() {
	try {
		const basePath = path.resolve(".wrangler/state/v3/d1")
		const dbFile = fs
			.readdirSync(basePath, { encoding: "utf-8", recursive: true })
			.find((f) => f.endsWith(".sqlite"))

		if (!dbFile) {
			throw new Error(`.sqlite file not found in ${basePath}`)
		}

		const url = path.resolve(basePath, dbFile)
		return url
	} catch (err) {
		console.error(err)

		return null
	}
}

export default defineConfig({
	out: "./migrations",
	schema: "./src/db/schema.ts",
	dialect: "sqlite",
	...(process.env.NODE_ENV === "production"
		? {
				driver: "d1-http",
				dbCredentials: {
					accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "317fb84f366ea1ab038ca90000953697",
					databaseId: process.env.DATABASE_ID || "931185e9-99e5-48f0-bf70-d03ca5936f2d",
					token: process.env.CLOUDFLARE_API_TOKEN,
				},
			}
		: {
				dbCredentials: {
					url: getLocalD1DB(),
				},
			}),
})
