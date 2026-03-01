import { defineConfig } from "drizzle-kit"

export default defineConfig({
	out: "./src/db/mysql-migrations",
	schema: "./src/db/schema.ts",
	dialect: "mysql",
	casing: "snake_case",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
})
