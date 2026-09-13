import { createRequire } from "node:module"
import { resolve } from "node:path"
import assert from "node:assert/strict"
const require = createRequire(import.meta.url)
const { Miniflare } = require(
  require.resolve("miniflare", { paths: [require.resolve("wrangler")] }),
)
const runtime = new Miniflare({
  workers: [
    {
      name: "wodsmith-start-smoke",
      modules: true,
      scriptPath: resolve("../wodsmith-start/dist/server/index.js"),
      modulesRoot: resolve("../wodsmith-start/dist/server"),
      modulesRules: [{ type: "ESModule", include: ["**/*.js"] }],
      compatibilityDate: "2026-04-15",
      compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
      kvNamespaces: ["OAUTH_KV", "KV_SESSION"],
      bindings: {
        AGENT_AUTH_ORIGIN: "https://app.example.test",
        AGENT_RESOURCE: "https://agent.example.test/mcp",
      },
    },
    {
      name: "binding-probe",
      modules: true,
      compatibilityDate: "2026-04-15",
      serviceBindings: {
        TRAINING: {
          name: "wodsmith-start-smoke",
          entrypoint: "AgentTrainingService",
        },
      },
      script: `export default { async fetch(request, env) {
    return Response.json({ authorized: await env.TRAINING.authorize('invalid-token'), outcome: await env.TRAINING.execute('invalid-token', 'get_training_context', {}) })
  } }`,
    },
  ],
})
try {
  const probe = await runtime.getWorker("binding-probe")
  const { authorized, outcome } = await (
    await probe.fetch("http://localhost/probe")
  ).json()
  assert.equal(authorized, false)
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, "NOT_AUTHORIZED")
  console.log(
    "Built private Worker entrypoint rejects invalid tokens without domain execution",
  )
} finally {
  await runtime.dispose()
}
