import { writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
const { generateMySQLDrizzleJson, generateMySQLMigration } = createRequire(import.meta.url)("drizzle-kit/api") as typeof import("drizzle-kit/api")
import * as schema from "../src/schema"

const output = process.argv[2]
if (!output) throw new Error("A test schema output path is required")
const empty = await generateMySQLDrizzleJson({}, undefined, "snake_case")
const current = await generateMySQLDrizzleJson(schema, empty.id, "snake_case")
await writeFile(output, JSON.stringify(await generateMySQLMigration(empty, current)))
