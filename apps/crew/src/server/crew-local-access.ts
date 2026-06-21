import { env } from "cloudflare:workers"

export class CrewLocalAccessError extends Error {
  constructor(featureName: string) {
    super(
      `${featureName} access is local-operator only until Crew auth is wired.`,
    )
    this.name = "CrewLocalAccessError"
  }
}

type CrewRuntimeEnv = typeof env & {
  NODE_ENV?: string
  STAGE?: string
  APP_URL?: string
  SITE_URL?: string
}

const localCrewStages = new Set(["dev", "local", "test"])

// @lat: [[crew#Event Setup Dashboard]]
// @lat: [[crew#Import CSV Preview#Private Upload Route]]
// @lat: [[crew#Department Leads]]
export function requireLocalCrewOperatorAccess(featureName = "Crew operator") {
  if (hasLocalCrewOperatorAccess()) return
  throw new CrewLocalAccessError(featureName)
}

// @lat: [[crew#Department Leads]]
export function hasLocalCrewOperatorAccess() {
  const runtimeEnv = env as CrewRuntimeEnv
  const nodeEnv = runtimeEnv.NODE_ENV?.toLowerCase()
  const stage = runtimeEnv.STAGE?.toLowerCase()
  const appUrl = (runtimeEnv.APP_URL ?? runtimeEnv.SITE_URL ?? "").toLowerCase()
  const appHost = getAppHost(appUrl)
  const isLocalStage = stage ? localCrewStages.has(stage) : false
  const isLocalUrl =
    appHost === "localhost" || appHost === "127.0.0.1" || appHost === "::1"
  const isProductionLike =
    (nodeEnv === "production" && !isLocalUrl) ||
    stage === "prod" ||
    stage === "production" ||
    stage === "demo" ||
    stage === "staging" ||
    appUrl.includes("wodsmith.com")

  return !isProductionLike && (isLocalStage || isLocalUrl)
}

function getAppHost(appUrl: string) {
  if (!appUrl) return ""

  try {
    const url = new URL(appUrl)
    if (url.hostname) return normalizeHost(url.hostname)
  } catch {
    // Fall back below for bare local hosts, like localhost:3000.
  }

  if (appUrl === "::1") return "::1"
  if (appUrl === "[::1]" || appUrl.startsWith("[::1]:")) return "::1"

  return normalizeHost(appUrl.split(":")[0] ?? "")
}

function normalizeHost(host: string) {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host
}
