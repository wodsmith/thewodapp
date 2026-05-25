import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const appRoot = process.cwd()
const duckDbBin =
	process.env.DUCKDB_BIN ??
	(existsSync(path.join(os.homedir(), ".local/bin/duckdb"))
		? path.join(os.homedir(), ".local/bin/duckdb")
		: "duckdb")
const workspaceDuckDb =
	process.env.OPENCLAW_DUCKDB ??
	"/Users/ianjones/.openclaw-dench/workspace/workspace.duckdb"
const localD1 =
	process.env.CRM_LOCAL_D1 ??
	findLocalD1(path.join(appRoot, ".alchemy/local/.wrangler/state/v3/d1")) ??
	findLocalD1(path.join(appRoot, ".wrangler/state/v3/d1"))

if (!localD1) {
	throw new Error("No local D1 sqlite file found. Run `pnpm alchemy:dev` first.")
}

if (!existsSync(workspaceDuckDb)) {
	throw new Error(`DuckDB file not found: ${workspaceDuckDb}`)
}

const tables = {
	objects: {
		columns: [
			"id",
			"name",
			"description",
			"icon",
			"default_view",
			"parent_document_id",
			"sort_order",
			"source_app",
			"immutable",
			"display_field",
			"created_at",
			"updated_at",
		],
		query: `
			SELECT id, name, description, icon, default_view, parent_document_id,
				sort_order, source_app, immutable, display_field,
				CAST(created_at AS VARCHAR) AS created_at,
				CAST(updated_at AS VARCHAR) AS updated_at
			FROM objects
			ORDER BY sort_order, name
		`,
	},
	fields: {
		columns: [
			"id",
			"object_id",
			"name",
			"description",
			"type",
			"required",
			"default_value",
			"related_object_id",
			"relationship_type",
			"enum_values",
			"enum_colors",
			"enum_multiple",
			"sort_order",
			"created_at",
			"updated_at",
		],
		query: `
			SELECT id, object_id, name, description, type, required, default_value,
				related_object_id, relationship_type,
				CAST(enum_values AS VARCHAR) AS enum_values,
				CAST(enum_colors AS VARCHAR) AS enum_colors,
				enum_multiple, sort_order,
				CAST(created_at AS VARCHAR) AS created_at,
				CAST(updated_at AS VARCHAR) AS updated_at
			FROM fields
			ORDER BY object_id, sort_order, name
		`,
	},
	entries: {
		columns: ["id", "object_id", "sort_order", "created_at", "updated_at"],
		query: `
			SELECT id, object_id, sort_order,
				CAST(created_at AS VARCHAR) AS created_at,
				CAST(updated_at AS VARCHAR) AS updated_at
			FROM entries
			ORDER BY object_id, sort_order, id
		`,
	},
	entry_fields: {
		columns: ["id", "entry_id", "field_id", "value", "created_at", "updated_at"],
		query: `
			SELECT id, entry_id, field_id, value,
				CAST(created_at AS VARCHAR) AS created_at,
				CAST(updated_at AS VARCHAR) AS updated_at
			FROM entry_fields
			ORDER BY entry_id, field_id
		`,
	},
	statuses: {
		columns: [
			"id",
			"object_id",
			"name",
			"color",
			"sort_order",
			"is_default",
			"created_at",
			"updated_at",
		],
		query: `
			SELECT id, object_id, name, color, sort_order, is_default,
				CAST(created_at AS VARCHAR) AS created_at,
				CAST(updated_at AS VARCHAR) AS updated_at
			FROM statuses
			ORDER BY object_id, sort_order, name
		`,
	},
	documents: {
		columns: [
			"id",
			"title",
			"icon",
			"cover_image",
			"file_path",
			"parent_id",
			"parent_object_id",
			"sort_order",
			"is_published",
			"created_at",
			"updated_at",
		],
		query: `
			SELECT id, title, icon, cover_image, file_path, parent_id, parent_object_id,
				sort_order, is_published,
				CAST(created_at AS VARCHAR) AS created_at,
				CAST(updated_at AS VARCHAR) AS updated_at
			FROM documents
			ORDER BY parent_id NULLS FIRST, sort_order, file_path
		`,
	},
}

const schemaMigrations = ["0000_initial-crm-schema.sql", "0001_entry-relations.sql"]
	.map((file) => readFileSync(path.join(appRoot, "src/db/migrations", file), "utf8"))
	.join("\n")
const dataMigrations = ["0002_company-crossfit-page-field.sql"]
	.map((file) => readFileSync(path.join(appRoot, "src/db/migrations", file), "utf8"))
	.join("\n")

const sql = [
	"PRAGMA foreign_keys = OFF;",
	"DROP TABLE IF EXISTS entry_relations;",
	"DROP TABLE IF EXISTS entry_fields;",
	"DROP TABLE IF EXISTS statuses;",
	"DROP TABLE IF EXISTS documents;",
	"DROP TABLE IF EXISTS fields;",
	"DROP TABLE IF EXISTS entries;",
	"DROP TABLE IF EXISTS objects;",
	schemaMigrations,
	"BEGIN TRANSACTION;",
]

const counts = {}
for (const [tableName, table] of Object.entries(tables)) {
	const rows = queryDuckDb(table.query)
	counts[tableName] = rows.length
	for (const row of rows) {
		sql.push(insertStatement(tableName, table.columns, row))
	}
}

const relations = queryDuckDb(`
	SELECT ef.entry_id AS source_entry_id, ef.field_id, ef.value AS target_entry_id,
		ROW_NUMBER() OVER (
			PARTITION BY ef.entry_id, ef.field_id
			ORDER BY ef.created_at, ef.id
		) - 1 AS sort_order,
		CAST(ef.created_at AS VARCHAR) AS created_at,
		CAST(ef.updated_at AS VARCHAR) AS updated_at
	FROM entry_fields ef
	JOIN fields f ON f.id = ef.field_id
	JOIN entries source_entry ON source_entry.id = ef.entry_id
	JOIN entries target_entry ON target_entry.id = ef.value
	WHERE f.type = 'relation'
		AND ef.value IS NOT NULL
		AND ef.value <> ''
	ORDER BY ef.entry_id, ef.field_id, ef.value
`)

counts.entry_relations = relations.length
for (const relation of relations) {
	sql.push(
		insertStatement(
			"entry_relations",
			[
				"id",
				"source_entry_id",
				"field_id",
				"target_entry_id",
				"sort_order",
				"created_at",
				"updated_at",
			],
			{
				id: relationId(relation),
				...relation,
			},
		),
	)
}

sql.push(
	dataMigrations,
	"COMMIT;",
	"PRAGMA foreign_keys = ON;",
)

runSqlite(localD1, sql.join("\n"))

const foreignKeyCheck = runSqlite(localD1, "PRAGMA foreign_key_check;")
if (foreignKeyCheck.trim()) {
	throw new Error(`Foreign key check failed: ${foreignKeyCheck.trim()}`)
}

const verification = runSqlite(
	localD1,
	[
		".mode json",
		"SELECT 'objects' AS table_name, COUNT(*) AS count FROM objects",
		"UNION ALL SELECT 'fields', COUNT(*) FROM fields",
		"UNION ALL SELECT 'entries', COUNT(*) FROM entries",
		"UNION ALL SELECT 'entry_fields', COUNT(*) FROM entry_fields",
		"UNION ALL SELECT 'entry_relations', COUNT(*) FROM entry_relations",
		"UNION ALL SELECT 'statuses', COUNT(*) FROM statuses",
		"UNION ALL SELECT 'documents', COUNT(*) FROM documents;",
	].join("\n"),
)

console.log(`Seeded ${localD1}`)
console.log(JSON.stringify({ source: workspaceDuckDb, counts, verification: JSON.parse(verification) }, null, 2))

function findLocalD1(root) {
	if (!existsSync(root)) return undefined

	const queue = [root]
	while (queue.length > 0) {
		const current = queue.shift()
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const entryPath = path.join(current, entry.name)
			if (entry.isDirectory()) {
				queue.push(entryPath)
			} else if (entry.isFile() && entry.name.endsWith(".sqlite")) {
				return entryPath
			}
		}
	}

	return undefined
}

function queryDuckDb(query) {
	const result = spawnSync(
		duckDbBin,
		[workspaceDuckDb, "-readonly", "-json", "-c", query],
		{
			encoding: "utf8",
			maxBuffer: 1024 * 1024 * 64,
		},
	)

	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout)
	}

	return JSON.parse(result.stdout || "[]")
}

function runSqlite(databasePath, input) {
	const result = spawnSync("sqlite3", [databasePath], {
		input,
		encoding: "utf8",
		maxBuffer: 1024 * 1024 * 64,
	})

	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout)
	}

	return result.stdout
}

function insertStatement(tableName, columns, row) {
	const columnList = columns.map((column) => `"${column}"`).join(", ")
	const values = columns.map((column) => sqlValue(row[column])).join(", ")
	return `INSERT INTO "${tableName}" (${columnList}) VALUES (${values});`
}

function sqlValue(value) {
	if (value === null || value === undefined) return "NULL"
	if (typeof value === "boolean") return value ? "1" : "0"
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL"
	return `'${String(value).replaceAll("'", "''")}'`
}

function relationId(relation) {
	return createHash("sha256")
		.update(`${relation.source_entry_id}:${relation.field_id}:${relation.target_entry_id}`)
		.digest("base64url")
		.slice(0, 32)
}
