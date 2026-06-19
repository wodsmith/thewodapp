import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Strips JSONC comments from a string
 * Handles both single-line (//) and multi-line comments
 * Respects strings (won't strip comment-like content inside strings)
 */
function stripJsonComments(str) {
	let result = ""
	let i = 0
	const len = str.length

	while (i < len) {
		const char = str[i]
		const next = str[i + 1]

		// Handle strings - don't process comments inside strings
		if (char === '"') {
			result += char
			i++
			while (i < len) {
				const c = str[i]
				result += c
				if (c === "\\") {
					i++
					if (i < len) {
						result += str[i]
					}
				} else if (c === '"') {
					break
				}
				i++
			}
			i++
			continue
		}

		// Handle single-line comments
		if (char === "/" && next === "/") {
			while (i < len && str[i] !== "\n") {
				i++
			}
			continue
		}

		// Handle multi-line comments
		if (char === "/" && next === "*") {
			i += 2
			while (i < len - 1) {
				if (str[i] === "*" && str[i + 1] === "/") {
					i += 2
					break
				}
				i++
			}
			continue
		}

		result += char
		i++
	}

	return result
}

/**
 * Parses the wrangler.jsonc file and returns the configuration object
 * Looks for the Alchemy-generated config at .alchemy/local/wrangler.jsonc
 * @returns {object} The parsed wrangler configuration
 * @throws {Error} If the file cannot be read or parsed
 */
export function parseWranglerConfig() {
	// Alchemy generates wrangler.jsonc in .alchemy/local/
	const wranglerPath = path.join(__dirname, "..", "..", ".alchemy", "local", "wrangler.jsonc")
	const wranglerContent = fs.readFileSync(wranglerPath, "utf8")

	// Remove comments from the JSONC content
	const jsonContent = stripJsonComments(wranglerContent)

	// Fix trailing commas in objects and arrays (which are valid in JSONC but not in JSON)
	const fixedJsonContent = jsonContent.replace(/,\s*([}\]])/g, "$1")

	try {
		return JSON.parse(fixedJsonContent)
	} catch (error) {
		throw new Error(`Failed to parse wrangler.jsonc: ${error.message}`)
	}
}

/**
 * Gets the D1 database configuration from wrangler.jsonc
 * @returns {{ name: string, id: string } | null} The database configuration or null if not found
 */
export function getD1Database() {
	const config = parseWranglerConfig()
	const d1Config = config.d1_databases?.[0]

	if (!d1Config) {
		return null
	}

	return {
		name: d1Config.database_name,
		id: d1Config.database_id,
	}
}
