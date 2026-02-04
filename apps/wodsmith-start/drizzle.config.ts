import { defineConfig } from "drizzle-kit"

export default defineConfig({
	out: "./src/db/mysql-migrations",
	schema: "./src/db/schema.ts",
	dialect: "mysql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
})
