import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const routeFiles = [
  "../../../src/routes/compete/$slug/index.tsx",
  "../../../src/routes/compete/$slug/workouts/index.tsx",
  "../../../src/routes/compete/$slug/workouts/$eventId.tsx",
  "../../../src/routes/compete/$slug/review/$eventId/index.tsx",
  "../../../src/routes/compete/organizer/$competitionId/events/$eventId/submissions/index.tsx",
  "../../../src/routes/compete/cohost/$competitionId/events/$eventId/submissions/index.tsx",
]

describe("video submission route gates", () => {
  // @lat: [[competition-type-capabilities#Video Submission Route Gates Test]]
  it("uses capability gates instead of literal online checks at submission routes", () => {
    for (const routeFile of routeFiles) {
      const source = readFileSync(
        fileURLToPath(new URL(routeFile, import.meta.url)),
        "utf8",
      )

      expect(source, routeFile).not.toContain(
        'competition.competitionType === "online"',
      )
      expect(source, routeFile).not.toContain(
        'competition.competitionType !== "online"',
      )
    }
  })
})
