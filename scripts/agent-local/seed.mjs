import { digest, nextMonday } from "./config.mjs"
import { createRequire } from "node:module"
import { readFile, writeFile } from "node:fs/promises"
import { pbkdf2Sync, randomBytes } from "node:crypto"
export async function seedFixture(config) {
  const require = createRequire(
    config.repo + "/apps/wodsmith-start/package.json",
  )
  const mysql = require("mysql2/promise")
  const db = await mysql.createConnection({
    host: "127.0.0.1",
    port: config.base + 5,
    user: "root",
  })
  const schema = await readFile(config.dir + "/schema.json", "utf8")
  const schemaHash = digest(schema)
  let previous
  try {
    previous = JSON.parse(await readFile(config.dir + "/fixture.json", "utf8"))
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  if (previous) {
    if (previous.schemaHash !== schemaHash)
      throw new Error(
        "Local schema changed. Stop this environment and move .agent-local aside to seed a fresh database; existing data is preserved.",
      )
    await db.changeUser({ database: "wodsmith_agent_local" })
    await db.ping()
    await db.end()
    return previous
  }
  await db.query("CREATE DATABASE wodsmith_agent_local")
  await db.changeUser({ database: "wodsmith_agent_local" })
  for (const sql of JSON.parse(schema)) await db.query(sql)
  const now = new Date()
  async function insert(table, row) {
    row = { created_at: now, updated_at: now, ...row }
    await db.query("INSERT INTO ?? SET ?", [table, row])
  }
  await insert("plans", {
    id: "free",
    name: "Local free plan",
    price: 0,
    is_active: 1,
  })
  const salt = randomBytes(16)
  const hash =
    salt.toString("hex") +
    ":" +
    pbkdf2Sync("LocalTraining123!", salt, 100000, 32, "sha256").toString("hex")
  await insert("users", {
    id: "usr_agent_local",
    first_name: "Local",
    last_name: "Athlete",
    email: "athlete@wodsmith.local",
    password_hash: hash,
    email_verified: now,
  })
  await insert("teams", {
    id: "team_agent_personal",
    name: "My local training",
    slug: "agent-local-personal",
    type: "personal",
    is_personal_team: 1,
    personal_team_owner_id: "usr_agent_local",
  })
  await insert("teams", {
    id: "team_agent_provider",
    name: "Local Programming Lab",
    slug: "agent-local-provider",
    type: "gym",
  })
  for (const team of ["team_agent_personal", "team_agent_provider"])
    await insert("team_memberships", {
      id: "member_" + team,
      user_id: "usr_agent_local",
      team_id: team,
      role_id: "owner",
      is_system_role: 1,
      is_active: 1,
    })
  for (const key of ["workout_tracking", "programming_tracks"]) {
    await insert("features", {
      id: "feat_local_" + key,
      key,
      name: key,
      category: "workouts",
      is_active: 1,
    })
    for (const team of ["team_agent_personal", "team_agent_provider"])
      await insert("team_feature_entitlements", {
        id: "ent_" + team + "_" + key,
        team_id: team,
        feature_id: "feat_local_" + key,
        is_active: 1,
      })
  }
  await insert("scaling_groups", {
    id: "sgrp_global_default",
    title: "Standard Scaling",
    is_default: 1,
    is_system: 1,
  })
  await insert("scaling_levels", {
    id: "slvl_global_rx",
    scaling_group_id: "sgrp_global_default",
    label: "Rx",
    position: 0,
    team_size: 1,
  })
  await insert("programming_tracks", {
    id: "track_agent_local",
    name: "Local weekly programming",
    description: "Seeded agent testing track",
    type: "team_owned",
    owner_team_id: "team_agent_provider",
    is_public: 1,
    scaling_group_id: "sgrp_global_default",
  })
  await insert("team_programming_tracks", {
    team_id: "team_agent_personal",
    track_id: "track_agent_local",
    is_active: 1,
    subscribed_at: now,
  })
  const week = nextMonday()
  const monday = new Date(week + "T00:00:00Z")
  for (let i = 0; i < 5; i++) {
    const id = "wod_agent_local_" + i
    const date = new Date(monday)
    date.setUTCDate(date.getUTCDate() + i)
    await insert("workouts", {
      id,
      name: [
        "Monday strength + conditioning",
        "Tuesday intervals",
        "Wednesday technique",
        "Thursday strength",
        "Friday mixed conditioning",
      ][i],
      description:
        "3 rounds: 400m run, 15 air squats, 10 push-ups. Adjust the session with your agent.",
      scheme: "time",
      score_type: "min",
      scope: "public",
      team_id: "team_agent_provider",
    })
    await insert("track_workouts", {
      id: "tw_agent_local_" + i,
      track_id: "track_agent_local",
      workout_id: id,
      track_order: i + 1,
      event_status: "published",
    })
    await insert("scheduled_workout_instances", {
      id: "sched_agent_local_" + i,
      team_id: "team_agent_provider",
      track_workout_id: "tw_agent_local_" + i,
      workout_id: id,
      scheduled_date: date,
    })
  }

  const [rows] = await db.query(
    "SELECT w.*,s.scheduled_date FROM workouts w JOIN scheduled_workout_instances s ON s.workout_id=w.id WHERE w.id LIKE ? ORDER BY s.scheduled_date",
    ["wod_agent_local_%"],
  )
  for (const w of rows) {
    const content = {
      title: w.name,
      coachNote:
        "Local programming fixture. Build your own session from this source.",
      isRestDay: false,
      blocks: [
        {
          id: "block_" + w.id,
          kind: "workout",
          title: "Conditioning",
          prescription: w.description,
          scalingGuidance: "Adjust volume as needed.",
          coachGuidance: "",
          workout: {
            name: w.name,
            description: w.description,
            scheme: w.scheme,
            scoreType: w.score_type,
            scope: "public",
            roundsToScore: 1,
            timeCapSeconds: null,
            repsPerRound: null,
            tiebreakScheme: null,
            scalingGroupId: "sgrp_global_default",
            movementIds: [],
          },
        },
      ],
    }
    await db.query("INSERT INTO training_sessions SET ?", {
      id: "session_" + w.id,
      team_id: "team_agent_provider",
      track_id: "track_agent_local",
      training_date: w.scheduled_date.toISOString().slice(0, 10),
      timezone: "America/Boise",
      revision: 1,
      published_version: 1,
      draft: JSON.stringify(content),
      published: JSON.stringify(content),
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  await db.end()
  const fixture = {
    schemaHash,
    week,
    email: "athlete@wodsmith.local",
    password: "LocalTraining123!",
  }
  await writeFile(
    config.dir + "/fixture.json",
    JSON.stringify(fixture, null, 2),
    { mode: 0o600 },
  )
  return fixture
}
