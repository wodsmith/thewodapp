#!/usr/bin/env bun
/**
 * Skill Packager - Creates a distributable .skill file of a skill folder
 *
 * Usage:
 *     bun package-skill.ts <path/to/skill-folder> [output-directory]
 *
 * Example:
 *     bun package-skill.ts .claude/skills/my-skill
 *     bun package-skill.ts .claude/skills/my-skill ./dist
 */

import { existsSync, statSync, mkdirSync } from "fs";
import { resolve, join, relative, basename } from "path";
import { file } from "bun";
import { validateSkill } from "./validate-skill";

async function getAllFiles(
	dirPath: string,
	baseDir: string,
): Promise<string[]> {
	const entries = await Array.fromAsync(
		new Bun.Glob("**/*").scan({ cwd: dirPath, absolute: false, onlyFiles: true }),
	);
	return entries.map((entry) => join(dirPath, entry));
}

async function packageSkill(
	skillPath: string,
	outputDir?: string,
): Promise<string | null> {
	const resolvedSkillPath = resolve(skillPath);

	// Validate skill folder exists
	if (!existsSync(resolvedSkillPath)) {
		console.log(`❌ Error: Skill folder not found: ${resolvedSkillPath}`);
		return null;
	}

	if (!statSync(resolvedSkillPath).isDirectory()) {
		console.log(`❌ Error: Path is not a directory: ${resolvedSkillPath}`);
		return null;
	}

	// Validate SKILL.md exists
	const skillMd = join(resolvedSkillPath, "SKILL.md");
	if (!existsSync(skillMd)) {
		console.log(`❌ Error: SKILL.md not found in ${resolvedSkillPath}`);
		return null;
	}

	// Run validation before packaging
	console.log("🔍 Validating skill...");
	const validation = validateSkill(resolvedSkillPath);
	if (!validation.valid) {
		console.log(`❌ Validation failed: ${validation.message}`);
		console.log("   Please fix the validation errors before packaging.");
		return null;
	}
	console.log(`✅ ${validation.message}\n`);

	// Determine output location
	const skillName = basename(resolvedSkillPath);
	const outputPath = outputDir ? resolve(outputDir) : process.cwd();

	if (!existsSync(outputPath)) {
		mkdirSync(outputPath, { recursive: true });
	}

	const skillFilename = join(outputPath, `${skillName}.skill`);

	// Create the .skill file (zip format) using Bun
	try {
		const files = await getAllFiles(
			resolvedSkillPath,
			resolve(resolvedSkillPath, ".."),
		);

		// Prepare files for zipping
		const zipEntries: Record<string, ArrayBuffer> = {};

		for (const filePath of files) {
			const arcname = relative(
				resolve(resolvedSkillPath, ".."),
				filePath,
			).replace(/\\/g, "/");
			const fileContent = await file(filePath).arrayBuffer();
			zipEntries[arcname] = fileContent;
			console.log(`  Added: ${arcname}`);
		}

		// Write zip file using JSZip
		await Bun.write(skillFilename, await createZip(zipEntries));

		console.log(`\n✅ Successfully packaged skill to: ${skillFilename}`);
		return skillFilename;
	} catch (e) {
		console.log(
			`❌ Error creating .skill file: ${e instanceof Error ? e.message : String(e)}`,
		);
		return null;
	}
}

// Helper function to create a zip file using JSZip
async function createZip(
	entries: Record<string, ArrayBuffer>,
): Promise<ArrayBuffer> {
	const JSZip = (await import("jszip")).default;
	const zip = new JSZip();

	for (const [path, content] of Object.entries(entries)) {
		zip.file(path, content);
	}

	return await zip.generateAsync({
		type: "arraybuffer",
		compression: "DEFLATE",
		compressionOptions: { level: 9 },
	});
}

function main() {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		console.log(
			"Usage: bun package-skill.ts <path/to/skill-folder> [output-directory]",
		);
		console.log("\nExample:");
		console.log("  bun package-skill.ts .claude/skills/my-skill");
		console.log("  bun package-skill.ts .claude/skills/my-skill ./dist");
		process.exit(1);
	}

	const skillPath = args[0];
	const outputDir = args[1];

	console.log(`📦 Packaging skill: ${skillPath}`);
	if (outputDir) {
		console.log(`   Output directory: ${outputDir}`);
	}
	console.log();

	packageSkill(skillPath, outputDir).then((result) => {
		process.exit(result ? 0 : 1);
	});
}

if (import.meta.main) {
	main();
}
