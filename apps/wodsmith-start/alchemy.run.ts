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
import { GitHubComment } from "alchemy/github"
import { CloudflareStateStore } from "alchemy/state"
import { WebhookEndpoint } from "alchemy/stripe"

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
/**
 * Current stage name for conditional configuration.
 * PR stages are formatted as `pr-{number}` (e.g., `pr-42`).
 */
const stage = process.env.STAGE ?? "dev"

/**
 * Whether the current stage needs Stripe webhook.
 * Only demo and production environments require the webhook resource.
 */
const needsStripeWebhook = stage === "demo" || stage === "prod"

/**
 * Whether Stripe environment variables are available.
 * Stripe env vars are populated for all environments when available.
 */
const hasStripeEnv =
	process.env.STRIPE_SECRET_KEY &&
	process.env.STRIPE_PUBLISHABLE_KEY &&
	process.env.STRIPE_CLIENT_ID

const app = await alchemy("wodsmith", {
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
	 * - "prod"    → Production database, wodsmith.com domain
	 * - "pr-42"   → PR preview with auto-generated workers.dev URL
	 */
	stage,

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

	/**
	 * State storage backend for tracking infrastructure state.
	 *
	 * @remarks
	 * - **Local development**: Uses FileSystemStateStore (`.alchemy/` directory)
	 * - **CI/CD pipelines**: Uses CloudflareStateStore for persistent, shared state
	 *
	 * CloudflareStateStore enables ephemeral CI runners to access state from
	 * previous deployments, which is required for incremental updates and destroy operations.
	 *
	 * @see {@link https://alchemy.run/docs/state-management State Management Docs}
	 */
	stateStore: process.env.CI
		? (scope) => new CloudflareStateStore(scope)
		: undefined,
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
const db = await D1Database("db", {
	/**
	 * Directory containing Drizzle migration SQL files.
	 * Migrations are applied in filename order on each deployment.
	 */
	migrationsDir: "./src/db/migrations",
	/**
	 * Adopt existing D1 database if it already exists.
	 * Required for production where resources were created before Alchemy.
	 */
	adopt: true,
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
const kvSession = await KVNamespace("wodsmith-sessions", {
	/**
	 * Adopt existing KV namespace if it already exists.
	 * Required for production where resources were created before Alchemy.
	 */
	adopt: true,
})

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
const r2Bucket = await R2Bucket("wodsmith-uploads", {
	/**
	 * Adopt existing R2 bucket if it already exists.
	 * Required for production where resources were created before Alchemy.
	 */
	adopt: true,
	/**
	 * Use remote R2 bucket during local development instead of Miniflare emulation.
	 * Required to get the actual devDomain URL and test with real uploads.
	 */
	dev: { remote: true },
	/**
	 * Enable r2.dev public URL for non-prod stages.
	 * Production uses a custom domain instead.
	 */
	devDomain: stage !== "prod",
	/**
	 * Custom domain for public access to bucket files.
	 * Only configured for production - other stages use the r2.dev URL.
	 */
	...(stage === "prod" && { domains: "uploads.wodsmith.com" }),
})

/**
 * Validate required Stripe environment variables when Stripe webhook is needed.
 * Fails fast with a clear error message if any required variables are missing.
 */
if (needsStripeWebhook) {
	const requiredStripeVars = [
		"STRIPE_SECRET_KEY",
		"STRIPE_PUBLISHABLE_KEY",
		"STRIPE_CLIENT_ID",
	] as const
	const missing = requiredStripeVars.filter((varName) => !process.env[varName])
	if (missing.length > 0) {
		throw new Error(
			`Missing required Stripe environment variables for stage "${stage}": ${missing.join(", ")}`,
		)
	}
}

/**
 * Stripe Webhook Endpoint for demo and production environments.
 *
 * This creates a Stripe webhook that receives events only for environments
 * that require webhook integration (demo and prod). Other environments
 * still get Stripe env vars for API calls but don't register webhooks.
 *
 * @remarks
 * **Required environment variables:**
 * - `STRIPE_SECRET_KEY`: Stripe secret key for server-side API authentication
 * - `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key for client-side Stripe.js
 * - `STRIPE_CLIENT_ID`: Stripe Connect OAuth client ID
 *
 * **Webhook URLs by stage:**
 * - prod: https://wodsmith.com/api/webhooks/stripe
 * - demo: https://demo.wodsmith.com/api/webhooks/stripe
 *
 * **Enabled events:**
 * - checkout.session.completed: Completes purchase and creates registration
 * - checkout.session.expired: Marks abandoned purchases as cancelled
 * - account.updated: Updates team's Stripe Connect status
 * - account.application.authorized: Logs OAuth connection confirmation
 * - account.application.deauthorized: Clears team Stripe connection
 *
 * @see {@link https://stripe.com/docs/webhooks Stripe Webhook Documentation}
 */
const stripeWebhookUrl =
	stage === "prod"
		? "https://wodsmith.com/api/webhooks/stripe"
		: "https://demo.wodsmith.com/api/webhooks/stripe"

const stripeWebhook = needsStripeWebhook
	? await WebhookEndpoint("stripe-webhook", {
			url: stripeWebhookUrl,
			enabledEvents: [
				"checkout.session.completed",
				"checkout.session.expired",
				"account.updated",
				"account.application.authorized",
				"account.application.deauthorized",
			],
			adopt: true,
		})
	: null

/**
 * Determines the custom domain(s) for the current deployment stage.
 *
 * @param currentStage - The current deployment stage (e.g., "dev", "prod", "demo", "pr-42")
 * @returns Array of domains for prod/demo stages, undefined for others (uses workers.dev)
 *
 * @remarks
 * Domain assignment logic:
 * - **prod**: Returns `["wodsmith.com"]` for production
 * - **demo**: Returns `["demo.wodsmith.com"]` for persistent staging/demo environment
 * - **pr-N**: Returns `undefined` to use auto-generated workers.dev subdomain (avoids DNS delays)
 * - **other**: Returns `undefined` to use auto-generated workers.dev subdomain
 *
 * @example
 * ```typescript
 * getDomains("prod")    // ["wodsmith.com"]
 * getDomains("demo")    // ["demo.wodsmith.com"]
 * getDomains("pr-42")   // undefined (uses workers.dev)
 * getDomains("staging") // undefined
 * getDomains("dev")     // undefined
 * ```
 */
function getDomains(currentStage: string): string[] | undefined {
	if (currentStage === "prod") {
		return ["wodsmith.com"]
	}
	if (currentStage === "demo") {
		return ["demo.wodsmith.com"]
	}
	// PR previews and other stages use auto-generated workers.dev URLs
	return undefined
}

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
 * | Environment | Domain                    | Notes                               |
 * |-------------|---------------------------|-------------------------------------|
 * | dev         | `*.workers.dev`           | Auto-generated Cloudflare subdomain |
 * | demo        | `demo.wodsmith.com`       | Persistent staging/demo environment |
 * | prod        | `wodsmith.com`            | Custom domain with SSL              |
 * | pr-N        | `*.workers.dev`           | Auto-generated (avoids DNS delays)  |
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
const website = await TanStackStart("app", {
	/**
	 * Cloudflare resource bindings available to the application.
	 *
	 * These bindings inject Cloudflare services into the Worker's environment.
	 * The binding names become properties on `env`.
	 *
	 * For environment variables and secrets, add them directly to bindings:
	 * - Plain strings become environment variables
	 * - Values wrapped in `alchemy.secret()` become encrypted secrets
	 */
	bindings: {
		/** D1 database binding for application data */
		DB: db,
		/** KV namespace binding for session storage */
		KV_SESSION: kvSession,
		/** R2 bucket binding for file uploads */
		R2_BUCKET: r2Bucket,

		// App configuration
		APP_URL: process.env.APP_URL!,

		/**
		 * Environment mode - CRITICAL for email sending!
		 * Must be "production" for emails to be sent via Resend.
		 * In dev mode, emails are logged to console only.
		 */
		NODE_ENV: stage === "prod" || stage === "demo" ? "production" : "development",

		/**
		 * Site URL used in email templates for links (verify email, reset password, etc.)
		 * Falls back to wodsmith.com if not set.
		 */
		SITE_URL: process.env.APP_URL || "https://wodsmith.com",

		// Email configuration
		EMAIL_FROM: "team@mail.wodsmith.com",
		EMAIL_FROM_NAME: "WODsmith",
		EMAIL_REPLY_TO: "support@mail.wodsmith.com",

		// Public URLs and keys
		// Use custom domain for prod, r2.dev domain for other stages
		// Fallback to known r2.dev URL if devDomain not yet provisioned
		R2_PUBLIC_URL: r2Bucket.domains?.[0]
			? `https://${r2Bucket.domains[0]}`
			: r2Bucket.devDomain
				? `https://${r2Bucket.devDomain}`
				: "https://pub-14c651314867492fa9637e830cc729a3.r2.dev",
		POSTHOG_KEY: "phc_UCtCVOUXvpuKzF50prCLKIWWCFc61j5CPTbt99OrKsK",
		TURNSTILE_SITE_KEY: "0x4AAAAAACF8K4v1TmFMOmtk",

		// Secrets
		TURNSTILE_SECRET_KEY: alchemy.secret(process.env.TURNSTILE_SECRET_KEY!),
		RESEND_API_KEY: alchemy.secret(process.env.RESEND_API_KEY!),

		// AI configuration (optional - only include if available)
		...(process.env.OPENAI_API_KEY && {
			OPENAI_API_KEY: alchemy.secret(process.env.OPENAI_API_KEY),
		}),
		...(process.env.BRAINTRUST_API_KEY && {
			BRAINTRUST_API_KEY: alchemy.secret(process.env.BRAINTRUST_API_KEY),
		}),

		// Stripe env vars are populated for all environments when available
		...(hasStripeEnv && {
			/** Stripe publishable key for client-side Stripe.js initialization */
			STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY!,
			/** Stripe Connect OAuth client ID */
			STRIPE_CLIENT_ID: process.env.STRIPE_CLIENT_ID!,
			/** Stripe secret key for server-side API calls */
			STRIPE_SECRET_KEY: alchemy.secret(process.env.STRIPE_SECRET_KEY!),
		}),
		// Webhook secret: use Alchemy-managed webhook for demo/prod, or .dev.vars for local dev
		...(stripeWebhook
			? {
					/** Stripe webhook secret for signature verification (Alchemy-managed) */
					STRIPE_WEBHOOK_SECRET: alchemy.secret(stripeWebhook.secret),
				}
			: process.env.STRIPE_WEBHOOK_SECRET
				? {
						/** Stripe webhook secret for local dev (from .dev.vars) */
						STRIPE_WEBHOOK_SECRET: alchemy.secret(
							process.env.STRIPE_WEBHOOK_SECRET,
						),
					}
				: {}),
	},

	/**
	 * Custom domains to bind to this Worker.
	 *
	 * @remarks
	 * Domains require:
	 * 1. DNS zone managed by Cloudflare
	 * 2. Appropriate DNS records (Alchemy creates these automatically)
	 *
	 * Domain assignment by environment:
	 * - **prod**: `wodsmith.com` (production domain)
	 * - **demo**: `demo.wodsmith.com` (persistent staging/demo environment)
	 * - **pr-N**: Auto-generated `*.workers.dev` subdomain (avoids DNS delays)
	 * - **other**: Auto-generated `*.workers.dev` subdomain
	 */
	domains: getDomains(stage),

	/**
	 * Adopt existing Worker if it already exists.
	 * Required for production where the Worker was created before Alchemy.
	 */
	adopt: true,
})

/**
 * GitHub PR comment with preview URL for pull request deployments.
 *
 * When deploying from a pull request (PULL_REQUEST env var is set), this resource
 * creates or updates a comment on the PR with the preview deployment URL.
 * This provides immediate feedback to reviewers about where to test the changes.
 *
 * @remarks
 * **Environment variables required:**
 * - `PULL_REQUEST`: PR number (set by CI workflow)
 * - `GITHUB_SHA`: Commit SHA for display (optional, auto-detected in GitHub Actions)
 * - `GITHUB_TOKEN`: Token with `pull-requests: write` permission (auto-available in Actions)
 *
 * **Comment behavior:**
 * - Creates a new comment on first deployment
 * - Updates existing comment on subsequent deployments (idempotent)
 * - Comment includes preview URL, commit SHA, and deployment timestamp
 *
 * @see {@link https://alchemy.run/docs/github GitHub Integration Docs}
 */
if (process.env.PULL_REQUEST) {
	const prNumber = Number(process.env.PULL_REQUEST)
	// Use default workers.dev URL to avoid DNS propagation delays
	const previewUrl = `https://wodsmith-app-pr-${prNumber}.zacjones93.workers.dev`
	const commitSha = process.env.GITHUB_SHA?.slice(0, 7) ?? "unknown"

	await GitHubComment("preview-comment", {
		owner: "wodsmith",
		repository: "thewodapp",
		issueNumber: prNumber,
		body: `## 🚀 Preview Deployed

**URL:** ${previewUrl}

| Detail | Value |
|--------|-------|
| Commit | \`${commitSha}\` |
| Stage | \`pr-${prNumber}\` |
| Deployed | ${new Date().toISOString()} |

---
_This comment is automatically updated on each push to this PR._`,
	})
}

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
