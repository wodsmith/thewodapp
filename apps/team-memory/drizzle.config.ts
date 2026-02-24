import {defineConfig} from 'drizzle-kit'

export default defineConfig({
	schema: './src/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
		databaseId: '6a9bfebb-696a-4254-9276-de6654cd951f',
		token: process.env.CLOUDFLARE_API_TOKEN!,
	},
})
