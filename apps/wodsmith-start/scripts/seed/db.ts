import mysql from "mysql2/promise"

let connection: mysql.Connection | null = null

export async function createClient(): Promise<mysql.Connection> {
	const url = process.env.DATABASE_URL
	if (!url) {
		console.error("DATABASE_URL environment variable is required")
		process.exit(1)
	}
	connection = await mysql.createConnection({ uri: url })
	return connection
}

export async function closeClient(): Promise<void> {
	await connection?.end()
	connection = null
}
