/**
 * Local-only placeholder for WODsmith Crew infrastructure.
 *
 * The Crew app is intentionally scaffolded without deployable Cloudflare,
 * PlanetScale, R2, KV, Queue, or production domain resources in this PR slice.
 * Real Crew infrastructure wiring belongs in the later deploy/resource slice.
 */

const message = [
  "WODsmith Crew infrastructure is disabled for this scaffold PR.",
  "Use `pnpm dev` to run the local app shell on port 3002.",
  "Real Alchemy resources will be introduced in a later deploy slice.",
].join("\n")

console.log(message)

export {}
