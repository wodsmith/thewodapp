#!/usr/bin/env node

import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const defaultConfigPath = resolve(homedir(), ".config/wodsmith/database.env")
const configPath = resolve(
  process.env.WODSMITH_DATABASE_ENV_FILE ?? defaultConfigPath,
)
const defaultTypeSafeConfigPath = resolve(
  homedir(),
  ".config/wodsmith/typesafe.env",
)
const typeSafeConfigPath = resolve(
  process.env.WODSMITH_TYPESAFE_ENV_FILE ?? defaultTypeSafeConfigPath,
)
const appDirectories = {
  crew: "apps/crew",
  "wodsmith-start": "apps/wodsmith-start",
}

function environmentValueFrom(contents, variable, source) {
  const value = parseEnv(contents)[variable]

  if (!value) {
    throw new Error(
      `${source} must contain ${variable}. Run pnpm setup:worktree after updating the shared config.`,
    )
  }

  return value
}

function databaseUrlFrom(contents, source) {
  const value = environmentValueFrom(contents, "DATABASE_URL", source)

  const url = new URL(value)
  if (url.protocol !== "mysql:") {
    throw new Error(`${source} DATABASE_URL must use the mysql protocol.`)
  }
  if (
    !url.username ||
    !url.password ||
    !url.hostname ||
    !url.pathname.slice(1)
  ) {
    throw new Error(
      `${source} DATABASE_URL must include username, password, host, and database.`,
    )
  }

  return value
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") return undefined
    throw error
  }
}

function selectedApps() {
  const appIndex = process.argv.indexOf("--app")
  if (appIndex === -1) return Object.keys(appDirectories)

  const app = process.argv[appIndex + 1]
  if (!Object.hasOwn(appDirectories, app)) {
    throw new Error(
      `Unknown app ${JSON.stringify(app)}. Expected ${Object.keys(appDirectories).join(" or ")}.`,
    )
  }
  return [app]
}

// @lat: [[architecture#Tech Stack#Shared Worktree Database Environment]]
async function main() {
  const apps = selectedApps()
  const canonicalContents = await readOptional(configPath)
  if (!canonicalContents) {
    throw new Error(
      `Shared database config not found at ${configPath}. Create it with a PlanetScale dev-branch DATABASE_URL, then run pnpm setup:worktree.`,
    )
  }
  const databaseUrl = databaseUrlFrom(canonicalContents, configPath)
  const typeSafeContents = apps.includes("wodsmith-start")
    ? await readOptional(typeSafeConfigPath)
    : undefined
  if (apps.includes("wodsmith-start") && !typeSafeContents) {
    throw new Error(
      `Shared TypeSafe config not found at ${typeSafeConfigPath}. Populate TYPESAFE_API_KEY from 1Password, then run pnpm setup:worktree.`,
    )
  }
  const typeSafeApiKey = typeSafeContents
    ? environmentValueFrom(
        typeSafeContents,
        "TYPESAFE_API_KEY",
        typeSafeConfigPath,
      )
    : undefined
  const checkOnly = process.argv.includes("--check")

  for (const app of apps) {
    const envPath = resolve(repositoryRoot, appDirectories[app], ".dev.vars")
    const current = await readOptional(envPath)
    const managedValues = {
      DATABASE_URL: databaseUrl,
      ...(app === "wodsmith-start" && typeSafeApiKey
        ? { TYPESAFE_API_KEY: typeSafeApiKey }
        : {}),
    }

    if (checkOnly) {
      if (!current) {
        throw new Error(
          `${envPath} is missing. Run pnpm setup:worktree in this worktree.`,
        )
      }
      for (const [variable, expected] of Object.entries(managedValues)) {
        const configured = environmentValueFrom(current, variable, envPath)
        if (configured !== expected) {
          throw new Error(
            `${envPath} has a stale ${variable}. Run pnpm setup:worktree to refresh it.`,
          )
        }
      }
      continue
    }

    const next = updateEnvironment(current ?? "", managedValues)

    await mkdir(dirname(envPath), { recursive: true })
    // Tighten existing files before writing secrets, not just afterwards.
    if (current !== undefined) await chmod(envPath, 0o600)
    await writeFile(envPath, next, { mode: 0o600 })
    await chmod(envPath, 0o600)
    console.log(`Configured shared development secrets for ${app}.`)
  }
}

function updateEnvironment(contents, values) {
  const remaining = new Set(Object.keys(values))
  const assignments = Object.fromEntries(
    Object.entries(values).map(([variable, value]) => {
      // Quote literal values so # and whitespace survive dotenv loading.
      const quote = ["'", "`", '"'].find(
        (candidate) => !value.includes(candidate),
      )
      const assignment = `${variable}=${quote}${value}${quote}`
      if (!quote || parseEnv(assignment)[variable] !== value) {
        throw new Error(`Cannot safely serialize ${variable} into .dev.vars.`)
      }
      return [variable, assignment]
    }),
  )
  // Match whole assignments, including unrelated multiline values, so a line
  // inside a quoted value cannot be mistaken for a managed setting.
  const pattern =
    /^[\t ]*(?:export[\t ]+)?([\w.-]+)[\t ]*=[\t ]*(?:'[^']*'|"[^"]*"|`[^`]*`|[^\r\n]*?)[\t ]*(?:#[^\r\n]*)?(?=\r?$)/gm
  const next = contents.replace(pattern, (assignment, variable) => {
    if (!Object.hasOwn(assignments, variable)) return assignment
    remaining.delete(variable)
    // A callback keeps $&, $', and $` in credentials literal. Replace every
    // duplicate because dotenv uses the last assignment.
    return assignments[variable]
  })
  return (
    [...remaining].map((variable) => `${assignments[variable]}\n`).join("") +
    next
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
