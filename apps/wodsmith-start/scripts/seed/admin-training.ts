import { createHash } from "node:crypto"
import type { Connection, RowDataPacket } from "mysql2/promise"
import { buildAdminTrainingDays } from "./data/admin-training"

export interface AdminTrainingSeedOptions {
  email: string
  teamId?: string
  startDate: string
  days?: number
  apply?: boolean
}

/** Add published demo days without replacing a coach's existing draft or release. */
export async function seedAdminTraining(client: Connection, options: AdminTrainingSeedOptions) {
  const days = buildAdminTrainingDays(options.startDate, options.days)
  await client.beginTransaction()
  try {
    const [candidates] = await client.query<RowDataPacket[]>(
      `SELECT DISTINCT t.id, t.name, t.default_track_id, t.settings, u.id AS user_id
       FROM users u JOIN team_memberships m ON m.user_id = u.id
       JOIN teams t ON t.id = m.team_id
       WHERE u.email = ? AND m.is_active = 1
         AND (m.expires_at IS NULL OR m.expires_at > UTC_TIMESTAMP())
         AND m.is_system_role = 1 AND m.role_id IN ('owner', 'admin')
         AND t.type IN ('gym', 'personal')
         AND (? IS NULL AND t.is_personal_team = 0 OR t.id = ?)
       ORDER BY t.id`,
      [options.email, options.teamId ?? null, options.teamId ?? null],
    )
    if (candidates.length !== 1) {
      throw new Error(`Expected one managed team for ${options.email}; found ${candidates.length}. Supply --team-id explicitly.`)
    }
    const team = candidates[0]
    // Serialize default creation and concurrent seeds for the same team.
    const [locked] = await client.query<RowDataPacket[]>(
      "SELECT default_track_id, settings FROM teams WHERE id = ? FOR UPDATE", [team.id],
    )
    const trackId = locked[0].default_track_id ?? `ptrk_demo_${createHash("sha256").update(team.id).digest("hex").slice(0, 24)}`
    const [tracks] = await client.query<RowDataPacket[]>(
      `SELECT p.id, p.name FROM programming_tracks p
       WHERE p.id = ? AND p.competition_id IS NULL AND p.type <> 'series-template'
       AND (p.owner_team_id = ? OR (p.is_public = 1 AND EXISTS (
         SELECT 1 FROM team_programming_tracks s WHERE s.track_id = p.id AND s.team_id = ? AND s.is_active = 1)))`,
      [trackId, team.id, team.id],
    )
    const createDefault = !locked[0].default_track_id && tracks.length === 0
    if (!createDefault && tracks.length !== 1) throw new Error("The team's default track is unavailable; no programming was changed")
    let timezone = "UTC"
    try {
      const candidate: unknown = JSON.parse(locked[0].settings ?? "{}").timezone
      if (typeof candidate === "string") {
        new Intl.DateTimeFormat("en", { timeZone: candidate })
        timezone = candidate
      }
    } catch { /* Match Training's fallback for absent or invalid team settings. */ }
    const [existing] = await client.query<RowDataPacket[]>(
      "SELECT training_date FROM training_sessions WHERE team_id = ? AND track_id = ? AND training_date BETWEEN ? AND ?",
      [team.id, trackId, days[0].date, days[days.length - 1].date],
    )
    const occupied = new Set(existing.map((row) => row.training_date))
    const additions = days.filter((day) => !occupied.has(day.date))
    if (options.apply) {
      if (createDefault) {
        await client.execute(
          `INSERT INTO programming_tracks (id, name, description, type, owner_team_id, is_public, created_at, updated_at, update_counter)
           VALUES (?, 'Everyday Training', 'Demo daily programming for training and session planning', 'team_owned', ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP(), 0)`,
          [trackId, team.id],
        )
      }
      if (!locked[0].default_track_id) {
        await client.execute("UPDATE teams SET default_track_id = ?, updated_at = UTC_TIMESTAMP() WHERE id = ? AND default_track_id IS NULL", [trackId, team.id])
      }
      for (const day of additions) {
        const id = `trn_demo_${createHash("sha256").update(`${team.id}:${trackId}:${day.date}`).digest("hex").slice(0, 40)}`
        await client.execute(
          `INSERT INTO training_sessions (id, team_id, track_id, training_date, timezone, revision, published_version, draft, published, created_at, updated_at, update_counter)
           VALUES (?, ?, ?, ?, ?, 1, 1, NULL, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), 0)`,
          [id, team.id, trackId, day.date, timezone, JSON.stringify(day.content)],
        )
      }
      await client.commit()
    } else await client.rollback()
    return {
      applied: !!options.apply, email: options.email, teamId: team.id, teamName: team.name,
      trackId, trackName: tracks[0]?.name ?? "Everyday Training", createDefault,
      timezone, startDate: days[0].date, endDate: days[days.length - 1].date,
      publishedDays: additions.length, workoutDays: additions.filter((day) => !day.content.isRestDay).length,
      restDays: additions.filter((day) => day.content.isRestDay).length, preservedDays: existing.length,
    }
  } catch (error) {
    await client.rollback()
    throw error
  }
}
