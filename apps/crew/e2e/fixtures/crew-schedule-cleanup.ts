import mysql, { type RowDataPacket } from "mysql2/promise"

export function requireCrewScheduleTestDatabase() {
  const url = process.env.DATABASE_URL
  if (!url || !/_(?:e2e|test)$/.test(new URL(url).pathname)) {
    throw new Error("The schedule creation test requires an isolated DATABASE_URL ending in _e2e or _test")
  }
  return url
}

export async function cleanupCrewScheduleTestEvent(url: string, eventName: string) {
  const connection = await mysql.createConnection({ uri: url })
  try {
    await connection.beginTransaction()
    const [events] = await connection.execute<RowDataPacket[]>(
      "SELECT id, competition_team_id FROM competitions WHERE name = ? AND organizing_team_id = ? FOR UPDATE",
      [eventName, "e2e_personal_team_test"],
    )
    for (const event of events) {
      await connection.execute("DELETE FROM crew_assignment_confirmations WHERE competition_id = ?", [event.id])
      await connection.execute(
        "DELETE a FROM volunteer_shift_assignments a INNER JOIN volunteer_shifts s ON s.id = a.shift_id WHERE s.competition_id = ?",
        [event.id],
      )
      await connection.execute("DELETE FROM volunteer_shifts WHERE competition_id = ?", [event.id])
      await connection.execute("DELETE FROM team_invitations WHERE team_id = ?", [event.competition_team_id])
      await connection.execute("DELETE FROM crew_event_settings WHERE competition_id = ?", [event.id])
      await connection.execute("DELETE FROM competitions WHERE id = ?", [event.id])
      await connection.execute("DELETE FROM teams WHERE id = ?", [event.competition_team_id])
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.end()
  }
}
