import { mkdir, writeFile } from "node:fs/promises"

// Build/typegen fixture only: no credentials, remote resources, or deployment.
const config = {
  name: "workout-import-local",
  main: "../../src/server.ts",
  compatibility_date: "2025-09-02",
  compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
  kv_namespaces: [{ binding: "KV_SESSION", id: "local-session" }],
  r2_buckets: [
    { binding: "R2_BUCKET", bucket_name: "local-uploads" },
    { binding: "R2_DOWNLOADS_BUCKET", bucket_name: "local-downloads" },
    { binding: "WORKOUT_IMPORT_SOURCES", bucket_name: "local-workout-import-sources" },
  ],
  durable_objects: { bindings: [
    { name: "JUDGE_SCHEDULER_AGENT", class_name: "JudgeSchedulerAgent" },
    { name: "WORKOUT_IMPORT_AGENT", class_name: "WorkoutImportAgent" },
  ] },
  migrations: [{ tag: "local-v1", new_sqlite_classes: ["JudgeSchedulerAgent", "WorkoutImportAgent"] }],
  images: { binding: "WORKOUT_IMPORT_IMAGES" },
  vars: { APP_URL: "http://localhost:33317", WORKOUT_IMPORT_GATEWAY: "wodsmith-import-dev" },
}
await mkdir(new URL("../.alchemy/local/", import.meta.url), { recursive: true })
await writeFile(new URL("../.alchemy/local/wrangler.jsonc", import.meta.url), JSON.stringify(config, null, 2) + "\n", { flag: "wx" })
console.log("Created .alchemy/local/wrangler.jsonc (build fixture; AI requires explicit live configuration)")
