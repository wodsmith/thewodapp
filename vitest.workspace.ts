import { defineWorkspace } from "vitest/config"

export default defineWorkspace([
	"apps/*/vitest.config.{ts,mjs}",
	"packages/*/vitest.config.{ts,mjs}",
])
