/**
 * Low-level MySQL query executor for PlanetScale.
 *
 * Port of D1DB from @mastra/cloudflare-d1, adapted for MySQL/PlanetScale.
 * Uses @planetscale/database Client for query execution.
 */

import { Client } from "@planetscale/database"
import type { StorageColumn, StorageColumnType } from "@mastra/core/storage"

interface MysqlDBConfig {
	url: string
	tablePrefix?: string
}

interface QueryOptions {
	sql: string
	params?: unknown[]
	first?: boolean
}

export class MysqlDB {
	private client: Client
	tablePrefix: string

	constructor(config: MysqlDBConfig) {
		this.client = new Client({ url: config.url })
		this.tablePrefix = config.tablePrefix || ""
	}

	getTableName(tableName: string): string {
		return `${this.tablePrefix}${tableName}`
	}

	async executeQuery(options: QueryOptions): Promise<any> {
		const { sql, params = [], first = false } = options
		const formattedParams = params.map((p) =>
			p === undefined || p === null ? null : p,
		)

		const result = await this.client.execute(sql, formattedParams)
		const rows = result.rows as Record<string, unknown>[]

		if (first) {
			return rows[0] || null
		}
		return rows
	}

	async hasColumn(table: string, column: string): Promise<boolean> {
		const fullTableName = table.startsWith(this.tablePrefix)
			? table
			: `${this.tablePrefix}${table}`
		const sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`
		const result = await this.executeQuery({
			sql,
			params: [fullTableName, column],
		})
		return Array.isArray(result) && result.length > 0
	}

	async getTableColumns(
		tableName: string,
	): Promise<{ name: string; type: string }[]> {
		const sql = `SELECT COLUMN_NAME as name, DATA_TYPE as type FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`
		const result = await this.executeQuery({ sql, params: [tableName] })
		if (!result || !Array.isArray(result)) return []
		return result as { name: string; type: string }[]
	}

	getSqlType(type: StorageColumnType): string {
		switch (type) {
			case "text":
				return "VARCHAR(255)"
			case "timestamp":
				return "DATETIME(3)"
			case "uuid":
				return "VARCHAR(36)"
			case "jsonb":
				return "JSON"
			case "integer":
				return "INT"
			case "float":
				return "FLOAT"
			case "bigint":
				return "BIGINT"
			case "boolean":
				return "TINYINT(1)"
			default:
				return "TEXT"
		}
	}

	getDefaultValue(type: StorageColumnType): string {
		switch (type) {
			case "text":
			case "uuid":
				return "DEFAULT ''"
			case "timestamp":
				return "DEFAULT CURRENT_TIMESTAMP(3)"
			case "jsonb":
				return ""
			case "integer":
			case "bigint":
				return "DEFAULT 0"
			case "float":
				return "DEFAULT 0.0"
			case "boolean":
				return "DEFAULT 0"
			default:
				return ""
		}
	}

	serializeValue(value: unknown): unknown {
		if (value === null || value === undefined) return null
		if (value instanceof Date) return value.toISOString()
		if (typeof value === "object") return JSON.stringify(value)
		return value
	}

	async processRecord(
		record: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		const processed: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(record)) {
			processed[key] = this.serializeValue(value)
		}
		return processed
	}

	async createTable({
		tableName,
		schema,
	}: { tableName: string; schema: Record<string, StorageColumn> }) {
		const fullTableName = this.getTableName(tableName)
		const columnDefinitions = Object.entries(schema).map(
			([colName, colDef]) => {
				const type =
					colDef.primaryKey && colDef.type === "text"
						? "VARCHAR(255)"
						: this.getSqlType(colDef.type)
				const nullable = colDef.nullable === false ? "NOT NULL" : ""
				const primaryKey = colDef.primaryKey ? "PRIMARY KEY" : ""
				return `\`${colName}\` ${type} ${nullable} ${primaryKey}`.trim()
			},
		)

		const sql = `CREATE TABLE IF NOT EXISTS \`${fullTableName}\` (${columnDefinitions.join(", ")}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
		await this.executeQuery({ sql })
	}

	async clearTable({ tableName }: { tableName: string }) {
		const fullTableName = this.getTableName(tableName)
		await this.executeQuery({ sql: `DELETE FROM \`${fullTableName}\`` })
	}

	async alterTable({
		tableName,
		schema,
		ifNotExists,
	}: {
		tableName: string
		schema: Record<string, StorageColumn>
		ifNotExists: string[]
	}) {
		const fullTableName = this.getTableName(tableName)
		const existingColumns = await this.getTableColumns(fullTableName)
		const existingColumnNames = new Set(existingColumns.map((col) => col.name))

		for (const [columnName, column] of Object.entries(schema)) {
			if (
				!existingColumnNames.has(columnName) &&
				ifNotExists.includes(columnName)
			) {
				const sqlType = this.getSqlType(column.type)
				const defaultValue = this.getDefaultValue(column.type)
				const sql = `ALTER TABLE \`${fullTableName}\` ADD COLUMN \`${columnName}\` ${sqlType} ${defaultValue}`
				await this.executeQuery({ sql })
			}
		}
	}

	async insert({
		tableName,
		record,
	}: { tableName: string; record: Record<string, unknown> }) {
		const fullTableName = this.getTableName(tableName)
		const processedRecord = await this.processRecord(record)
		const columns = Object.keys(processedRecord)
		const values = Object.values(processedRecord)
		const placeholders = columns.map(() => "?").join(", ")
		const quotedColumns = columns.map((c) => `\`${c}\``).join(", ")

		const sql = `INSERT INTO \`${fullTableName}\` (${quotedColumns}) VALUES (${placeholders})`
		await this.executeQuery({ sql, params: values })
	}

	async upsert({
		tableName,
		record,
		conflictColumns: _conflictColumns,
		updateColumns,
	}: {
		tableName: string
		record: Record<string, unknown>
		conflictColumns: string[]
		updateColumns: string[]
	}) {
		const fullTableName = this.getTableName(tableName)
		const processedRecord = await this.processRecord(record)
		const columns = Object.keys(processedRecord)
		const values = Object.values(processedRecord)
		const placeholders = columns.map(() => "?").join(", ")
		const quotedColumns = columns.map((c) => `\`${c}\``).join(", ")

		const updateClause = updateColumns
			.map((col) => `\`${col}\` = VALUES(\`${col}\`)`)
			.join(", ")

		const sql = `INSERT INTO \`${fullTableName}\` (${quotedColumns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`
		await this.executeQuery({ sql, params: values })
	}

	async batchUpsert({
		tableName,
		records,
	}: { tableName: string; records: Record<string, unknown>[] }) {
		if (records.length === 0) return

		const batchSize = 50
		for (let i = 0; i < records.length; i += batchSize) {
			const batch = records.slice(i, i + batchSize)
			for (const record of batch) {
				const columns = Object.keys(record)
				const updateColumns = columns.filter((col) => col !== "createdAt")
				await this.upsert({
					tableName,
					record,
					conflictColumns: ["id"],
					updateColumns,
				})
			}
		}
	}

	async load({
		tableName,
		keys,
	}: {
		tableName: string
		keys: Record<string, unknown>
	}): Promise<Record<string, unknown> | null> {
		const fullTableName = this.getTableName(tableName)
		const conditions = Object.keys(keys)
			.map((k) => `\`${k}\` = ?`)
			.join(" AND ")
		const values = Object.values(keys)

		const sql = `SELECT * FROM \`${fullTableName}\` WHERE ${conditions} ORDER BY \`createdAt\` DESC LIMIT 1`
		const result = await this.executeQuery({ sql, params: values, first: true })

		if (!result) return null

		const deserialized: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(
			result as Record<string, unknown>,
		)) {
			if (
				typeof value === "string" &&
				(value.startsWith("{") || value.startsWith("["))
			) {
				try {
					deserialized[key] = JSON.parse(value)
				} catch {
					deserialized[key] = value
				}
			} else {
				deserialized[key] = value
			}
		}
		return deserialized
	}
}
