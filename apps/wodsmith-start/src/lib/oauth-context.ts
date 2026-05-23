/**
 * Request-scoped storage for the OAuth provider helpers.
 *
 * `@cloudflare/workers-oauth-provider` attaches its helpers to the `env` arg it
 * passes to `defaultHandler.fetch`. That mutation is not visible through
 * `import { env } from "cloudflare:workers"`, so server functions can't access
 * the helpers directly. We capture them here in AsyncLocalStorage at the
 * handler boundary and read them back from the consent route's server fns.
 */

import "server-only"
import { AsyncLocalStorage } from "node:async_hooks"
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider"

const storage = new AsyncLocalStorage<OAuthHelpers>()

export function runWithOAuthHelpers<T>(
  helpers: OAuthHelpers | undefined,
  fn: () => T,
): T {
  if (!helpers) return fn()
  return storage.run(helpers, fn)
}

export function getOAuthHelpersFromContext(): OAuthHelpers | undefined {
  return storage.getStore()
}
