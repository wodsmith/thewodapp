import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const routeFiles = [
  "../../../src/routes/compete/organizer/$competitionId/invites/index.tsx",
  "../../../src/routes/compete/organizer/series/$groupId/divisions.tsx",
  "../../../src/routes/compete/organizer/series/$groupId/leaderboard.tsx",
  "../../../src/routes/compete/series/$groupId/leaderboard.tsx",
]

describe("feature-flag route gates", () => {
  // @lat: [[architecture#Tech Stack#Feature-Gated Route Hydration]]
  it("renders nothing until each route flag is explicitly enabled", () => {
    for (const routeFile of routeFiles) {
      const source = readFileSync(
        fileURLToPath(new URL(routeFile, import.meta.url)),
        "utf8",
      )

      expect(source, routeFile).toContain(
        "useState<boolean | undefined>(undefined)",
      )
      expect(source, routeFile).toContain(
        "if (flagEnabled === false) {",
      )
      expect(source, routeFile).toContain(
        "if (flagEnabled !== true) return null",
      )
    }
  })
})
