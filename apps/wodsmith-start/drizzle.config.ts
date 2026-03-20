import { defineConfig } from "drizzle-kit"

const url = new URL(process.env.DATABASE_URL!)
const isLocalhost =
	url.hostname === "localhost" || url.hostname === "127.0.0.1"

export default defineConfig({
	out: "./src/db/mysql-migrations",
	schema: "./src/db/schema.ts",
	dialect: "mysql",
	casing: "snake_case",
	dbCredentials: {
		host: url.hostname,
		user: decodeURIComponent(url.username),
		password: url.password ? decodeURIComponent(url.password) : undefined,
		database: url.pathname.slice(1),
		ssl: isLocalhost ? undefined : { rejectUnauthorized: true },
	},
})
