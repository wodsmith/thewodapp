import alchemy from "alchemy"
import { D1Database, Hyperdrive, R2Bucket, TanStackStart } from "alchemy/cloudflare"
import { CloudflareStateStore } from "alchemy/state"

const stage = process.env.STAGE ?? "dev"

const app = await alchemy("ledger", {
	stage,
	phase: process.argv.includes("--destroy") ? "destroy" : "up",
	stateStore: process.env.CI
		? (scope) => new CloudflareStateStore(scope)
		: undefined,
})

const db = await D1Database("db", {
	migrationsDir: "./src/db/migrations",
	adopt: true,
})

/**
 * PlanetScale connection for reading financial events.
 *
 * Uses DATABASE_URL directly — ledger reuses the same credentials
 * as wodsmith-start rather than creating a separate PlanetScale password.
 * Set DATABASE_URL in .env (local dev) or as a GitHub secret (CI/prod).
 */
// biome-ignore lint/style/noNonNullAssertion: Required for PlanetScale connection
const databaseUrl = new URL(process.env.DATABASE_URL!)

const hyperdrive = await Hyperdrive(`ledger-hyperdrive-${stage}`, {
	origin: {
		host: databaseUrl.hostname,
		database: databaseUrl.pathname.slice(1),
		user: decodeURIComponent(databaseUrl.username),
		password: decodeURIComponent(databaseUrl.password),
		port: 3306,
		scheme: "mysql",
	},
	caching: {
		disabled: false,
	},
	adopt: true,
	dev: {
		origin: process.env.DATABASE_URL!,
	},
})

const r2Bucket = await R2Bucket("ledger-documents", {
	adopt: true,
	dev: { remote: true },
	devDomain: stage !== "prod",
})

function getDomains(currentStage: string): string[] | undefined {
	if (currentStage === "prod") {
		return ["ledger.wodsmith.com"]
	}
	return undefined
}

const website = await TanStackStart("app", {
	bindings: {
		DB: db,
		R2_BUCKET: r2Bucket,
		HYPERDRIVE: hyperdrive,
		// biome-ignore lint/style/noNonNullAssertion: Set at deploy time
		APP_URL: process.env.APP_URL!,
		// biome-ignore lint/style/noNonNullAssertion: Required for PlanetScale fallback in local dev
		DATABASE_URL: process.env.DATABASE_URL!,
		NODE_ENV: stage === "prod" ? "production" : "development",
		// biome-ignore lint/style/noNonNullAssertion: Required
		LEDGER_AUTH_PASSWORD: alchemy.secret(process.env.LEDGER_AUTH_PASSWORD!),
		// biome-ignore lint/style/noNonNullAssertion: Required for session signing
		LEDGER_SESSION_SECRET: alchemy.secret(process.env.LEDGER_SESSION_SECRET!),
		// biome-ignore lint/style/noNonNullAssertion: Required for doc analyzer
		OPENAI_API_KEY: alchemy.secret(process.env.OPENAI_API_KEY_PROD!),
	},
	domains: getDomains(stage),
	adopt: true,
})

export type Env = typeof website.Env
export default website

await app.finalize()
