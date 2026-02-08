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

const website = await TanStackStart("app", {
	bindings: {
		DB: db,
		R2_BUCKET: r2Bucket,
		// biome-ignore lint/style/noNonNullAssertion: Set at deploy time
		APP_URL: process.env.APP_URL!,
		NODE_ENV: stage === "prod" ? "production" : "development",
		// Password for accessing the app - set via environment variable
		// biome-ignore lint/style/noNonNullAssertion: Required
		AUTH_PASSWORD: alchemy.secret(process.env.AUTH_PASSWORD!),
	},
	adopt: true,
})

export type Env = typeof website.Env
export default website

await app.finalize()
