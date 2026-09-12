import { parseArgs } from "node:util"
import mysql from "mysql2/promise"
import { seedAdminTraining } from "./seed/admin-training"

const { values } = parseArgs({
  options: {
    email: { type: "string", default: "admin@example.com" },
    "team-id": { type: "string" },
    start: { type: "string", default: "2026-09-12" },
    days: { type: "string", default: "61" },
    apply: { type: "boolean", default: false },
  },
})
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the intended seed database")
const client = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: "Z" })
try {
  console.log(JSON.stringify(await seedAdminTraining(client, {
    email: values.email, teamId: values["team-id"], startDate: values.start,
    days: Number(values.days), apply: values.apply,
  }), null, 2))
} finally {
  await client.end()
}
