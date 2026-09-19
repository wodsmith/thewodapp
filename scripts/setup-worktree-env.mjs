#!/usr/bin/env node

import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

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
  const match = contents.match(new RegExp(`^${variable}=(.*)$`, "m"))
  const value = match?.[1]?.trim().replace(/^(['"])(.*)\1$/, "$2")

  if (!value) {
    throw new Error(`${source} must contain ${variable}.`)
  }

  return value
}

function databaseUrlFrom(contents, source) {
  const value = environmentValueFrom(contents, "DATABASE_URL", source)

  const url = new URL(value)
  if (url.protocol !== "mysql:") {
    throw new Error(`${source} DATABASE_URL must use the mysql protocol.`)
  }
  if (!url.username || !url.password || !url.hostname || !url.pathname.slice(1)) {
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
  if (!appDirectories[app]) {
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

    let next = current ?? ""
    for (const [variable, value] of Object.entries(managedValues)) {
      const pattern = new RegExp(`^${variable}=.*$`, "m")
      next = pattern.test(next)
        ? next.replace(pattern, `${variable}=${value}`)
        : `${variable}=${value}\n${next}`
    }

    await mkdir(dirname(envPath), { recursive: true })
    await writeFile(envPath, next, { mode: 0o600 })
    await chmod(envPath, 0o600)
    console.log(`Configured shared development secrets for ${app}.`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
