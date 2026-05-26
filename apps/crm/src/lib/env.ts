import { env } from "cloudflare:workers"
import { createServerOnlyFn } from "@tanstack/react-start"

export const getSessionSecret = createServerOnlyFn((): string => {
  const key = env.CRM_SESSION_SECRET
  if (!key) {
    throw new Error("CRM_SESSION_SECRET not configured")
  }
  return key
})

export const getAuthPassword = createServerOnlyFn((): string => {
  const password = env.CRM_AUTH_PASSWORD
  if (!password) {
    throw new Error("CRM_AUTH_PASSWORD not configured")
  }
  return password
})

export const isSecureAppUrl = createServerOnlyFn((): boolean => {
  return env.APP_URL?.startsWith("https://") ?? false
})

export const getR2Bucket = createServerOnlyFn(() => {
  return env.R2_BUCKET
})
