import alchemy from "alchemy"
import { D1Database, Hyperdrive, R2Bucket, TanStackStart } from "alchemy/cloudflare"
import { Password as PlanetScalePassword } from "alchemy/planetscale"
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
 * PlanetScale database credentials.
 * Reuses the same wodsmith-db database — ledger reads from the same schema.
 */
const psDbName = "wodsmith-db"
const psOrg = process.env.PLANETSCALE_ORGANIZATION ?? "wodsmith"

const psPassword = await PlanetScalePassword(`ledger-ps-password-${stage}`, {
	organization: psOrg,
	database: psDbName,
	branch: stage === "prod" ? "main" : "dev",
	role: "reader",
})

const hyperdrive = await Hyperdrive(`ledger-hyperdrive-${stage}`, {
	origin: {
		host: psPassword.host,
		database: psDbName,
		user: psPassword.username,
		password: psPassword.password.unencrypted,
		port: 3306,
		scheme: "mysql",
	},
	caching: {
		disabled: false,
	},
	adopt: true,
	dev: {
		origin: `mysql://${psPassword.username}:${psPassword.password.unencrypted}@${psPassword.host}:3306/${psDbName}?sslaccept=strict`,
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
		DATABASE_URL: `mysql://${psPassword.username}:${psPassword.password.unencrypted}@${psPassword.host}:3306/${psDbName}?sslaccept=strict`,
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
