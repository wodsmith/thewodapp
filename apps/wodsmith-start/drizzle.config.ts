import { defineConfig } from "drizzle-kit"

const url = new URL(process.env.DATABASE_URL!)

export default defineConfig({
  out: "./src/db/mysql-migrations",
  schema: "./src/db/schema.ts",
  dialect: "mysql",
  casing: "snake_case",
  dbCredentials: {
    host: url.hostname,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  },
})
