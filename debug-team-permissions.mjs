import { createClient } from "@libsql/client"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/libsql"

// This is a quick debug script to check team permissions
// You'll need to replace these with actual database schema imports

const client = createClient({
	url: process.env.DATABASE_URL || "file:local.db",
})

const db = drizzle(client)

async function debugTeamPermissions(teamId, userId) {
	console.log(
		`Debugging team permissions for teamId: ${teamId}, userId: ${userId}`,
	)

	try {
		// Query team membership directly
		const query = `
      SELECT 
        tm.userId,
        tm.teamId, 
        tm.roleId,
        tm.isSystemRole,
        t.name as teamName,
        t.slug as teamSlug
      FROM team_membership tm
      JOIN team t ON tm.teamId = t.id
      WHERE tm.teamId = ? AND tm.userId = ?
    `

		const result = await client.execute({
			sql: query,
			args: [teamId, userId],
		})

		console.log("Team membership result:", result.rows)
	} catch (error) {
		console.error("Error querying team permissions:", error)
	}
}

// You would call this with actual values:
// debugTeamPermissions('team_x3uimzsry6hvkfk0wlrxl6bu', 'user_id_here');

console.log(
	"Debug script loaded. Call debugTeamPermissions(teamId, userId) to test.",
)
