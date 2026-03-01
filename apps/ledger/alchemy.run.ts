import alchemy from "alchemy"
import { D1Database, R2Bucket, TanStackStart } from "alchemy/cloudflare"
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
		// biome-ignore lint/style/noNonNullAssertion: Set at deploy time
		APP_URL: process.env.APP_URL!,
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
