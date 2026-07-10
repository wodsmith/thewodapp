import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import * as crewBadge from "../../../apps/crew/src/components/ui/badge"
import * as crewButton from "../../../apps/crew/src/components/ui/button"
import * as crewCard from "../../../apps/crew/src/components/ui/card"
import * as crewCn from "../../../apps/crew/src/utils/cn"
import * as crewInput from "../../../apps/crew/src/components/ui/input"
import * as crewLabel from "../../../apps/crew/src/components/ui/label"
import * as crewSeparator from "../../../apps/crew/src/components/ui/separator"
import * as crewSkeleton from "../../../apps/crew/src/components/ui/skeleton"
import * as crewSpinner from "../../../apps/crew/src/components/ui/spinner"
import * as crewTable from "../../../apps/crew/src/components/ui/table"
import * as crewTextarea from "../../../apps/crew/src/components/ui/textarea"
import * as sharedBadge from "../src/components/badge"
import * as sharedButton from "../src/components/button"
import * as sharedCard from "../src/components/card"
import * as sharedCn from "../src/utils/cn"
import * as sharedInput from "../src/components/input"
import * as sharedLabel from "../src/components/label"
import * as sharedSeparator from "../src/components/separator"
import * as sharedSkeleton from "../src/components/skeleton"
import * as sharedSpinner from "../src/components/spinner"
import * as sharedTable from "../src/components/table"
import * as sharedTextarea from "../src/components/textarea"
import * as startBadge from "../../../apps/wodsmith-start/src/components/ui/badge"
import * as startButton from "../../../apps/wodsmith-start/src/components/ui/button"
import * as startCard from "../../../apps/wodsmith-start/src/components/ui/card"
import * as startCn from "../../../apps/wodsmith-start/src/utils/cn"
import * as startInput from "../../../apps/wodsmith-start/src/components/ui/input"
import * as startLabel from "../../../apps/wodsmith-start/src/components/ui/label"
import * as startSeparator from "../../../apps/wodsmith-start/src/components/ui/separator"
import * as startSkeleton from "../../../apps/wodsmith-start/src/components/ui/skeleton"
import * as startSpinner from "../../../apps/wodsmith-start/src/components/ui/spinner"
import * as startTable from "../../../apps/wodsmith-start/src/components/ui/table"
import * as startTextarea from "../../../apps/wodsmith-start/src/components/ui/textarea"

type ModuleExports = Record<string, unknown>

const compatibilityModules: Array<
  [string, ModuleExports, ModuleExports, ModuleExports]
> = [
  ["badge", sharedBadge, startBadge, crewBadge],
  ["button", sharedButton, startButton, crewButton],
  ["card", sharedCard, startCard, crewCard],
  ["cn", sharedCn, startCn, crewCn],
  ["input", sharedInput, startInput, crewInput],
  ["label", sharedLabel, startLabel, crewLabel],
  ["separator", sharedSeparator, startSeparator, crewSeparator],
  ["skeleton", sharedSkeleton, startSkeleton, crewSkeleton],
  ["spinner", sharedSpinner, startSpinner, crewSpinner],
  ["table", sharedTable, startTable, crewTable],
  ["textarea", sharedTextarea, startTextarea, crewTextarea],
]

describe("Start and Crew compatibility adapters", () => {
  it.each(compatibilityModules)(
    "%s re-exports the shared implementation",
    (_name, shared, start, crew) => {
      const exportNames = Object.keys(shared).sort()

      expect(Object.keys(start).sort()).toEqual(exportNames)
      expect(Object.keys(crew).sort()).toEqual(exportNames)

      for (const exportName of exportNames) {
        expect(start[exportName]).toBe(shared[exportName])
        expect(crew[exportName]).toBe(shared[exportName])
      }
    },
  )
})

describe("Tailwind v4 package contract", () => {
  it("exposes shared styles and scans package component sources", async () => {
    const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url))
    const [packageStyles, startStyles, crewStyles] = await Promise.all([
      readFile(`${repositoryRoot}/packages/ui/src/styles.css`, "utf8"),
      readFile(`${repositoryRoot}/apps/wodsmith-start/src/styles.css`, "utf8"),
      readFile(`${repositoryRoot}/apps/crew/src/styles.css`, "utf8"),
    ])

    expect(packageStyles).toContain('@source "./components";')
    expect(packageStyles).toContain("@theme {")
    expect(packageStyles).toContain("--color-background:")

    for (const appStyles of [startStyles, crewStyles]) {
      const tailwindImport = appStyles.indexOf('@import "tailwindcss";')
      const uiImport = appStyles.indexOf('@import "@repo/ui/styles.css";')
      const typographyPlugin = appStyles.indexOf(
        '@plugin "@tailwindcss/typography";',
      )

      expect(tailwindImport).toBeGreaterThanOrEqual(0)
      expect(uiImport).toBeGreaterThan(tailwindImport)
      expect(typographyPlugin).toBeGreaterThan(uiImport)
      expect(appStyles).not.toContain("@theme {")
      expect(appStyles).not.toContain("--background:")
    }
  })
})
