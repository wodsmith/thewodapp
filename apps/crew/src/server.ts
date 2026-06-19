/**
 * Custom server entry point for the trimmed WODsmith Crew shell.
 *
 * This slice intentionally exposes only the TanStack Start request handler.
 * Queue consumers, AI agent Durable Objects, Stripe workflows, and other
 * WODsmith Start product handlers stay out of the Crew runtime until a later
 * slice introduces those features deliberately.
 */

import * as Sentry from "@sentry/cloudflare"
import handler from "@tanstack/react-start/server-entry"
import { getSentryOptions } from "./lib/sentry/server"

export default Sentry.withSentry((env: Env) => getSentryOptions(env), {
  fetch(request) {
    return handler.fetch(request)
  },
} satisfies ExportedHandler<Env>)
