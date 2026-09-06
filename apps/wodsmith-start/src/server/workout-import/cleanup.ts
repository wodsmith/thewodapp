import { env } from "cloudflare:workers"
import { getAgentByName } from "agents"

/** Invoke after a successful transaction (including receipt retry); never fail the committed save. */
export async function cleanupSavedWorkoutImport(input: {
  userId: string
  importId: string
}) {
  const agent = await getAgentByName(env.WORKOUT_IMPORT_AGENT, input.importId)
  await agent.purgeSaved(input.userId)
}
