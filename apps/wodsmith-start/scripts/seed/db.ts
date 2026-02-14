import { Client } from "@planetscale/database"

export function createClient(): Client {
	const url = process.env.DATABASE_URL
	if (!url) {
		console.error("DATABASE_URL environment variable is required")
		process.exit(1)
	}
	return new Client({ url })
}
