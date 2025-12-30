/**
 * @fileoverview Alchemy Infrastructure-as-Code configuration for wodsmith-start.
 *
 * Alchemy is a TypeScript-native IaC library that deploys cloud infrastructure to
 * Cloudflare Workers. This file defines all infrastructure resources and bindings
 * for the wodsmith-start TanStack Start application.
 *
 * ## Environment Handling
 *
 * Alchemy uses a **stage-based** environment model. Each stage represents an isolated
 * deployment environment with its own resources (database, KV namespace, R2 bucket, etc.).
 *
 * ### Environment Detection
 *
 * The environment is determined by the `STAGE` environment variable:
 * - `STAGE=dev` (default) → Development environment
 * - `STAGE=staging` → Staging environment
 * - `STAGE=prod` → Production environment
 *
 * Each stage creates separate Cloudflare resources with stage-prefixed names:
 * - `dev` → `wodsmith-db-dev`, `wodsmith-sessions-dev`, etc.
 * - `staging` → `wodsmith-db-staging`, `wodsmith-sessions-staging`, etc.
 * - `prod` → `wodsmith-db-prod`, `wodsmith-sessions-prod`, etc.
 *
 * ### Deployment Phases
 *
 * Alchemy supports two deployment phases:
 * - `up` (default) → Create or update infrastructure
 * - `destroy` → Tear down all resources for a stage
 *
 * The phase is controlled via CLI flag (`--destroy`) or programmatically.
 *
 * ## Usage Examples
 *
 * ### Development (default)
 * ```bash
 * # Deploy to dev stage (creates/updates resources)
 * npx alchemy deploy
 *
 * # Or explicitly specify stage
 * STAGE=dev npx alchemy deploy
 *
 * # Destroy dev stage resources
 * npx alchemy deploy --destroy
 * ```
 *
 * ### Staging
 * ```bash
 * # Deploy to staging
 * STAGE=staging npx alchemy deploy
 *
 * # Destroy staging resources
 * STAGE=staging npx alchemy deploy --destroy
 * ```
 *
 * ### Production
 * ```bash
 * # Deploy to production
 * STAGE=prod npx alchemy deploy
 *
 * # ⚠️ Destroy production (use with extreme caution!)
 * STAGE=prod npx alchemy deploy --destroy
 * ```
 *
 * ## State Management
 *
 * Alchemy tracks resource state to enable incremental updates. By default:
 * - **Local development**: FileSystemStateStore (`.alchemy/` directory)
 * - **Production**: Can be configured to use CloudflareStateStore for persistent state
 *
 * State files are encrypted using ALCHEMY_PASSWORD environment variable.
 *
 * ## Configuration Options
 *
 * | Option    | Type                  | Description                                      |
 * |-----------|-----------------------|--------------------------------------------------|
 * | `stage`   | `string`              | Environment name (dev/staging/prod)              |
 * | `phase`   | `"up" \| "destroy"`   | Deploy or tear down resources                    |
 * | `quiet`   | `boolean`             | Suppress console output                          |
 * | `password`| `string`              | Encryption key for secrets (from ALCHEMY_PASSWORD)|
 * | `dev`     | `boolean`             | Enable local development mode with emulated bindings |
 *
 * @see {@link https://alchemy.run/docs Alchemy Documentation}
 * @see {@link https://developers.cloudflare.com/workers/ Cloudflare Workers Docs}
 *
 * @module alchemy.run
 */

import alchemy from "alchemy"
import {
	D1Database,
	KVNamespace,
	R2Bucket,
	TanStackStart,
} from "alchemy/cloudflare"

/**
 * Initialize the Alchemy application context.
 *
 * This creates an Alchemy "app" that manages infrastructure state and coordinates
 * resource deployment. All resource definitions must be within the app context,
 * and `app.finalize()` must be called at the end to execute the deployment.
 *
 * @remarks
 * The stage determines which isolated environment is being deployed to.
 * Resources are automatically namespaced by stage to prevent conflicts.
 *
 * Environment-specific behavior:
 * - **dev**: Fast iteration, local emulation available with `--dev` flag
 * - **staging**: Mirror of production for testing
 * - **prod**: Production deployment with custom domain binding
 *
 * @example
 * ```bash
 * # Override stage via environment variable
 * STAGE=staging npx alchemy deploy
 *
 * # Override via CLI argument
 * npx alchemy deploy --stage prod
 * ```
 */
const app = await alchemy("wodsmith-start", {
	/**
	 * Deployment stage/environment name.
	 *
	 * Each stage maintains completely isolated resources. Setting this to different
	 * values creates separate infrastructure stacks that don't interfere with each other.
	 *
	 * @default "dev"
	 *
	 * @example
	 * - "dev"     → Development database, no custom domain
	 * - "staging" → Staging database, staging domain (if configured)
	 * - "prod"    → Production database, start.wodsmith.com domain
	 */
	stage: process.env.STAGE ?? "dev",

	/**
	 * Deployment phase: create/update (`up`) or tear down (`destroy`).
	 *
	 * When `destroy` is specified, Alchemy will delete all resources for the
	 * current stage. This is irreversible - use with caution in production!
	 *
	 * @remarks
	 * The destroy phase stops execution after the alchemy() call - no resources
	 * are created, only deleted. This prevents accidental recreation of resources.
	 *
	 * @example
	 * ```bash
	 * # Destroy via CLI flag (recommended)
	 * npx alchemy deploy --destroy
	 *
	 * # Programmatic destroy (for scripts)
	 * const app = await alchemy("my-app", { phase: "destroy" });
	 * ```
	 */
	phase: process.argv.includes("--destroy") ? "destroy" : "up",
})

/**
 * Cloudflare D1 SQLite database for application data.
 *
 * D1 is Cloudflare's serverless SQLite database. This binding provides:
 * - Automatic schema migrations from the migrations directory
 * - Type-safe database access via Drizzle ORM
 * - Edge-local reads with global replication
 *
 * @remarks
 * **Environment-specific notes:**
 * - Each stage gets a separate database instance
 * - Migrations run automatically on deployment
 * - Database name is stage-prefixed: `wodsmith-db-{stage}`
 *
 * **Access in application:**
 * ```typescript
 * import { getDb } from "~/db";
 * const db = getDb(env.DB);
 * const users = await db.query.users.findMany();
 * ```
 *
 * @see {@link https://developers.cloudflare.com/d1/ D1 Documentation}
 */
const db = await D1Database("wodsmith-db", {
	/**
	 * Directory containing Drizzle migration SQL files.
	 * Migrations are applied in filename order on each deployment.
	 */
	migrationsDir: "./src/db/migrations",
})

/**
 * Cloudflare KV namespace for session storage.
 *
 * KV provides globally distributed key-value storage with:
 * - Sub-millisecond reads at the edge
 * - Eventual consistency (writes propagate globally within ~60s)
 * - Automatic expiration support for session tokens
 *
 * @remarks
 * **Environment-specific notes:**
 * - Each stage has isolated session data
 * - Sessions don't leak between dev/staging/prod
 * - KV namespace name is stage-prefixed: `wodsmith-sessions-{stage}`
 *
 * **Access in application:**
 * ```typescript
 * import { createKvSessionStorage } from "~/utils/kv-session";
 * const storage = createKvSessionStorage(env.KV_SESSION);
 * ```
 *
 * @see {@link https://developers.cloudflare.com/kv/ KV Documentation}
 */
const kvSession = await KVNamespace("wodsmith-sessions")

/**
 * Cloudflare R2 bucket for file uploads and media storage.
 *
 * R2 provides S3-compatible object storage with:
 * - Zero egress fees
 * - Automatic CDN integration
 * - Multipart upload support for large files
 *
 * @remarks
 * **Environment-specific notes:**
 * - Each stage has a separate bucket
 * - Production may have additional lifecycle/CORS policies
 * - Bucket name is stage-prefixed: `wodsmith-uploads-{stage}`
 *
 * **Access in application:**
 * ```typescript
 * const object = await env.R2_BUCKET.put(key, file);
 * const url = await env.R2_BUCKET.get(key);
 * ```
 *
 * @see {@link https://developers.cloudflare.com/r2/ R2 Documentation}
 */
const r2Bucket = await R2Bucket("wodsmith-uploads")

/**
 * TanStack Start application deployment configuration.
 *
 * This deploys the TanStack Start SSR application to Cloudflare Workers with:
 * - Server-side rendering at the edge
 * - Full-stack type safety
 * - All Cloudflare bindings available in server functions
 *
 * @remarks
 * **Environment-specific behavior:**
 *
 * | Environment | Domain                  | Notes                              |
 * |-------------|-------------------------|------------------------------------|
 * | dev         | `*.workers.dev`         | Auto-generated Cloudflare subdomain|
 * | staging     | `*.workers.dev`         | Or configure staging.wodsmith.com  |
 * | prod        | `start.wodsmith.com`    | Custom domain with SSL             |
 *
 * The `bindings` object makes Cloudflare resources available in your server code
 * via the `env` object. Types are automatically inferred and exported as `Env`.
 *
 * **Access bindings in server functions:**
 * ```typescript
 * import { createServerFn } from "@tanstack/start";
 *
 * export const getData = createServerFn()
 *   .handler(async ({ context }) => {
 *     const env = context.cloudflare.env;
 *     // env.DB, env.KV_SESSION, env.R2_BUCKET are typed!
 *   });
 * ```
 *
 * @see {@link https://tanstack.com/start/latest TanStack Start Docs}
 */
const website = await TanStackStart("wodsmith-start", {
	/**
	 * Cloudflare resource bindings available to the application.
	 *
	 * These bindings inject Cloudflare services into the Worker's environment.
	 * The binding names (DB, KV_SESSION, R2_BUCKET) become properties on `env`.
	 */
	bindings: {
		/** D1 database binding for application data */
		DB: db,
		/** KV namespace binding for session storage */
		KV_SESSION: kvSession,
		/** R2 bucket binding for file uploads */
		R2_BUCKET: r2Bucket,
	},

	/**
	 * Custom domains to bind to this Worker.
	 *
	 * @remarks
	 * Domains require:
	 * 1. DNS zone managed by Cloudflare
	 * 2. Appropriate DNS records (Alchemy creates these automatically)
	 *
	 * In development/staging, you typically omit this to use the auto-generated
	 * `*.workers.dev` subdomain.
	 */
	domains: ["start.wodsmith.com"],
})

/**
 * Exported environment type for use throughout the application.
 *
 * This type is automatically inferred from the TanStack Start bindings and provides
 * full type safety when accessing Cloudflare resources in server functions.
 *
 * @example
 * ```typescript
 * // In src/types/env.d.ts
 * import type { Env } from "../../alchemy.run";
 *
 * declare global {
 *   interface CloudflareEnv extends Env {}
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Type-safe access to bindings
 * function handler(env: Env) {
 *   const db = env.DB;        // D1Database type
 *   const kv = env.KV_SESSION; // KVNamespace type
 *   const r2 = env.R2_BUCKET;  // R2Bucket type
 * }
 * ```
 */
export type Env = typeof website.Env

/**
 * Default export of the website resource for external reference.
 *
 * This can be imported by other Alchemy configurations if needed for
 * cross-resource references or composite deployments.
 */
export default website

/**
 * Finalize the Alchemy deployment.
 *
 * This is **required** - it executes all pending resource operations and
 * updates the state file. Without this call, no resources are actually deployed.
 *
 * @remarks
 * The finalize step:
 * 1. Resolves all resource dependencies
 * 2. Computes the diff between current and desired state
 * 3. Creates, updates, or deletes resources as needed
 * 4. Persists the new state for future deployments
 */
await app.finalize()
