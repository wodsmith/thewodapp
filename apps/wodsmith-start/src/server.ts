/**
 * Custom server entry point for TanStack Start on Cloudflare Workers.
 *
 * This file extends the default TanStack Start server entry to add
 * Cloudflare-specific handlers like scheduled (cron) triggers.
 *
 * OBSERVABILITY:
 * - All HTTP requests are wrapped with request context for tracing
 * - Each request gets a unique requestId that flows through all logs
 * - HTTP-level logging only for errors and slow requests (reduces noise)
 * - Business-level logging in server functions provides the real visibility
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/hosting#custom-server-entry
 */

import type {
  ExecutionContext,
  MessageBatch,
  ScheduledController,
} from "@cloudflare/workers-types"
import * as Sentry from "@sentry/cloudflare"
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { env, waitUntil } from "cloudflare:workers"
import { sendBatchToPostHog } from "evlog/posthog"
import { createWorkersLogger, initWorkersLogger } from "evlog/workers"
import { withEvlog } from "./lib/evlog"
import {
  extractRequestInfo,
  logError,
  logInfo,
  logWarning,
  withRequestContext,
} from "./lib/logging"
import { getSentryOptions } from "./lib/sentry/server"

// Sensitive field names to redact as a safety net in the drain.
// This catches any PII that accidentally leaks through log.set().
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "creditcard",
  "ssn",
  "captcha",
]

function deepSanitize(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      result[key] = "[REDACTED]"
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === "object"
          ? deepSanitize(item as Record<string, unknown>)
          : item,
      )
    } else if (value !== null && typeof value === "object") {
      result[key] = deepSanitize(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

// Initialize evlog once at module scope.
// The PostHog drain reads POSTHOG_KEY from cloudflare:workers env at emit time
// (process.env is not available in CF Workers, so we can't use createPostHogDrain's
// built-in env resolution).
initWorkersLogger({
  env: { service: "wodsmith-start" },
  // Show wide events in console during local dev, suppress in prod (drain handles it)
  silent: !import.meta.env.DEV,
  drain: (ctx) => {
    // Only drain events that have accumulated business context (action field)
    // This skips bare framework events (loaders with no log.set() calls)
    if (!ctx.event.action) return
    const apiKey = (env as unknown as Record<string, string | undefined>)
      .POSTHOG_KEY
    if (!apiKey) return
    // Sanitize before sending to prevent PII leakage
    ctx.event = deepSanitize(ctx.event) as typeof ctx.event
    const drainPromise = sendBatchToPostHog([ctx.event], { apiKey }).catch(
      (err) => {
        console.error("[evlog/drain] Failed to send to PostHog:", err)
      },
    )
    // Ensure the drain fetch completes even after the response is sent
    try {
      waitUntil(drainPromise)
    } catch {
      // waitUntil may not be available in some contexts (e.g., local dev)
    }
  },
})

// Workers runtime requires Workflow classes to be exported from the entry point
export { StripeCheckoutWorkflow } from "./workflows/stripe-checkout-workflow"
export { ManualRegistrationWorkflow } from "./workflows/manual-registration-workflow"

// Threshold for logging slow requests (in ms)
const SLOW_REQUEST_THRESHOLD_MS = 2000

// Create the base TanStack Start entry with default fetch handling
const startEntry = createServerEntry({
  fetch(request) {
    return handler.fetch(request)
  },
})

/**
 * Wrap fetch handler with request context.
 * Only logs errors and slow requests to reduce noise - business logic
 * in server functions handles the meaningful logging.
 */
async function fetchWithLogging(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const requestInfo = extractRequestInfo(request)
  const startTime = Date.now()

  // Skip request context for static assets
  const isStaticAsset =
    requestInfo.path.startsWith("/_build/") ||
    requestInfo.path.startsWith("/assets/") ||
    requestInfo.path.endsWith(".js") ||
    requestInfo.path.endsWith(".css") ||
    requestInfo.path.endsWith(".ico") ||
    requestInfo.path.endsWith(".png") ||
    requestInfo.path.endsWith(".jpg") ||
    requestInfo.path.endsWith(".svg") ||
    requestInfo.path.endsWith(".woff2")

  // Static assets don't need request context overhead
  if (isStaticAsset) {
    return startEntry.fetch(request)
  }

  // Create evlog request logger for wide event accumulation
  const log = createWorkersLogger(request)

  // Decode TanStack Start server function paths into readable names
  // /_serverFn/<base64> → "competition-detail-fns.getCompetitionByIdFn"
  if (requestInfo.path.startsWith("/_serverFn/")) {
    try {
      const encoded = requestInfo.path.slice("/_serverFn/".length)
      const decoded = JSON.parse(atob(encoded)) as {
        file?: string
        export?: string
      }
      const file = decoded.file
        ?.replace(/^\/@id\/src\/server-fns\//, "")
        ?.replace(/\.ts\?.*$/, "")
      const fn = decoded.export?.replace(/_createServerFn_handler$/, "")
      if (file && fn) {
        log.set({ serverFn: `${file}.${fn}` })
      }
    } catch {
      // Non-server-fn encoded path, ignore
    }
  }

  return withRequestContext(
    {
      method: requestInfo.method,
      path: requestInfo.path,
    },
    () =>
      withEvlog(log, async () => {
        try {
          const response = await startEntry.fetch(request)
          const durationMs = Date.now() - startTime

          // Only log errors or slow requests
          if (response.status >= 400) {
            logWarning({
              message: `[HTTP] ${requestInfo.method} ${requestInfo.path} -> ${response.status}`,
              attributes: {
                httpMethod: requestInfo.method,
                httpPath: requestInfo.path,
                status: response.status,
                durationMs,
              },
            })
          } else if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
            logWarning({
              message: `[HTTP] Slow request: ${requestInfo.method} ${requestInfo.path}`,
              attributes: {
                httpMethod: requestInfo.method,
                httpPath: requestInfo.path,
                status: response.status,
                durationMs,
              },
            })
          }

          // Emit the wide event with accumulated context
          log.emit({ status: response.status })

          return response
        } catch (error) {
          const durationMs = Date.now() - startTime

          logError({
            message: `[HTTP] ${requestInfo.method} ${requestInfo.path} -> Error`,
            error,
            attributes: {
              httpMethod: requestInfo.method,
              httpPath: requestInfo.path,
              durationMs,
            },
          })

          // Emit the wide event with error context
          log.error(
            error instanceof Error ? error : new Error(String(error)),
          )
          log.emit({ status: 500 })

          throw error
        }
      }),
  )
}

/**
 * Export the server entry with additional Cloudflare Workers handlers.
 *
 * Wrapped with Sentry.withSentry for server-side error tracking and APM.
 * This object conforms to Cloudflare's ExportedHandler interface:
 * - `fetch`: Handles all HTTP requests (with logging and request context)
 * - `scheduled`: Handles cron trigger events (monitored by Sentry)
 */
export default Sentry.withSentry((env: Env) => getSentryOptions(env), {
  // HTTP requests with logging and request context
  fetch: fetchWithLogging,

  // Cloudflare cron trigger handler - invoked directly by Cloudflare's scheduler.
  // Schedule configured in alchemy.run.ts (every 15 minutes).
  async scheduled(
    controller: ScheduledController,
    _env: Env,
    _ctx: ExecutionContext,
  ) {
    // Wrap cron execution with request context for tracing
    return withRequestContext(
      {
        method: "CRON",
        path: controller.cron,
      },
      async () => {
        await Sentry.withMonitor(
          "submission-window-notifications",
          async () => {
            logInfo({
              message: "[Cron] Scheduled handler triggered",
              attributes: {
                cron: controller.cron,
                scheduledTime: controller.scheduledTime,
              },
            })

            try {
              // Dynamic import to keep cold start fast
              const { processSubmissionWindowNotifications } = await import(
                "./server/notifications/submission-window"
              )

              const result = await processSubmissionWindowNotifications()

              logInfo({
                message: "[Cron] Submission window notifications processed",
                attributes: {
                  cron: controller.cron,
                  windowOpens: result.windowOpens,
                  windowCloses24h: result.windowCloses24h,
                  windowCloses1h: result.windowCloses1h,
                  windowCloses15m: result.windowCloses15m,
                  windowClosed: result.windowClosed,
                  errors: result.errors,
                },
              })
            } catch (err) {
              logError({
                message:
                  "[Cron] Failed to process submission window notifications",
                error: err,
                attributes: {
                  cron: controller.cron,
                  scheduledTime: controller.scheduledTime,
                },
              })
              // Re-throw so Sentry.withMonitor detects failure
              throw err
            }
          },
          {
            schedule: {
              type: "crontab",
              value: "*/15 * * * *",
            },
          },
        )
      },
    )
  },
  // Cloudflare Queue consumer for broadcast email delivery.
  // Messages are enqueued by sendBroadcastFn and processed here asynchronously.
  async queue(
    batch: MessageBatch,
    _env: Env,
    _ctx: ExecutionContext,
  ) {
    // Dynamic import to keep cold start fast
    const { handleBroadcastEmailQueue } = await import(
      "./server/broadcast-queue-consumer"
    )
    await handleBroadcastEmailQueue(batch)
  },
} satisfies ExportedHandler<Env>)
