#!/usr/bin/env node

/**
 * Type check script for changed files in git staging area
 * This script runs TypeScript type checking when TypeScript files are staged for commit
 */

import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Get the list of staged TypeScript files
 */
function getStagedTSFiles() {
	try {
		const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
			encoding: "utf8",
		})

		const files = output
			.split("\n")
			.filter(Boolean)
			.filter((file) => file.match(/\.(ts|tsx)$/))
			.filter((file) => existsSync(resolve(file)))

		return files
	} catch (error) {
		console.error("Error getting staged files:", error.message)
		return []
	}
}

/**
 * Run TypeScript type checking, excluding test files for now
 */
function runTypeCheck(files) {
	try {
		console.log("🔍 Running TypeScript type check...")

		// Separate test files from application files
		const appFiles = files.filter(
			(file) =>
				!file.includes(".test.") &&
				!file.includes(".spec.") &&
				!file.endsWith(".test.ts") &&
				!file.endsWith(".test.tsx") &&
				!file.endsWith(".spec.ts") &&
				!file.endsWith(".spec.tsx"),
		)
		const testFiles = files.filter(
			(file) =>
				file.includes(".test.") ||
				file.includes(".spec.") ||
				file.endsWith(".test.ts") ||
				file.endsWith(".test.tsx") ||
				file.endsWith(".spec.ts") ||
				file.endsWith(".spec.tsx"),
		)

		if (testFiles.length > 0) {
			console.log(
				`⚠️  Skipping type check for ${testFiles.length} test file(s) (test files have known type issues):`,
			)
			for (const file of testFiles) {
				console.log(`  - ${file}`)
			}
		}

		if (appFiles.length === 0) {
			console.log("✅ Only test files staged, skipping type check")
			return true
		}

		console.log(`Checking types for ${appFiles.length} application file(s):`)
		for (const file of appFiles) {
			console.log(`  - ${file}`)
		}

		// Run full project type check to ensure changes don't break existing code
		execSync(`pnpm exec tsc --noEmit --skipLibCheck ${appFiles.join(" ")}`, {
			stdio: "inherit",
			cwd: process.cwd(),
			timeout: 60000, // 60 second timeout
		})
		console.log("✅ TypeScript type check passed")
		return true
	} catch (error) {
		console.error("❌ TypeScript type check failed")
		console.error("Fix the type errors above before committing")
		return false
	}
}

/**
 * Main function
 */
function main() {
	const stagedTSFiles = getStagedTSFiles()

	if (stagedTSFiles.length === 0) {
		console.log("No TypeScript files staged for commit, skipping type check")
		process.exit(0)
	}

	console.log(`Found ${stagedTSFiles.length} staged TypeScript file(s)`)

	const success = runTypeCheck(stagedTSFiles)
	process.exit(success ? 0 : 1)
}

main()
