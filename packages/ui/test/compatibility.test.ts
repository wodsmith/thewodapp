import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import * as crewBadge from "../../../apps/crew/src/components/ui/badge"
import * as crewAlert from "../../../apps/crew/src/components/ui/alert"
import * as crewAvatar from "../../../apps/crew/src/components/ui/avatar"
import * as crewBreadcrumb from "../../../apps/crew/src/components/ui/breadcrumb"
import * as crewButton from "../../../apps/crew/src/components/ui/button"
import * as crewCard from "../../../apps/crew/src/components/ui/card"
import * as crewCheckbox from "../../../apps/crew/src/components/ui/checkbox"
import * as crewCollapsible from "../../../apps/crew/src/components/ui/collapsible"
import * as crewCn from "../../../apps/crew/src/utils/cn"
import * as crewDialog from "../../../apps/crew/src/components/ui/dialog"
import * as crewDropdownMenu from "../../../apps/crew/src/components/ui/dropdown-menu"
import * as crewField from "../../../apps/crew/src/components/ui/field"
import * as crewForm from "../../../apps/crew/src/components/ui/form"
import * as crewHoverCard from "../../../apps/crew/src/components/ui/hover-card"
import * as crewInput from "../../../apps/crew/src/components/ui/input"
import * as crewLabel from "../../../apps/crew/src/components/ui/label"
import * as crewPopover from "../../../apps/crew/src/components/ui/popover"
import * as crewProgress from "../../../apps/crew/src/components/ui/progress"
import * as crewRadioGroup from "../../../apps/crew/src/components/ui/radio-group"
import * as crewSelect from "../../../apps/crew/src/components/ui/select"
import * as crewScrollArea from "../../../apps/crew/src/components/ui/scroll-area"
import * as crewSeparator from "../../../apps/crew/src/components/ui/separator"
import * as crewSheet from "../../../apps/crew/src/components/ui/sheet"
import * as crewSkeleton from "../../../apps/crew/src/components/ui/skeleton"
import * as crewSpinner from "../../../apps/crew/src/components/ui/spinner"
import * as crewTable from "../../../apps/crew/src/components/ui/table"
import * as crewTabs from "../../../apps/crew/src/components/ui/tabs"
import * as crewTextarea from "../../../apps/crew/src/components/ui/textarea"
import * as crewTooltip from "../../../apps/crew/src/components/ui/tooltip"
import * as sharedBadge from "@repo/ui/badge"
import * as sharedAlert from "@repo/ui/alert"
import * as sharedAvatar from "@repo/ui/avatar"
import * as sharedBreadcrumb from "@repo/ui/breadcrumb"
import * as sharedButton from "@repo/ui/button"
import * as sharedCard from "@repo/ui/card"
import * as sharedCheckbox from "@repo/ui/checkbox"
import * as sharedCollapsible from "@repo/ui/collapsible"
import * as sharedCn from "@repo/ui/cn"
import * as sharedDialog from "@repo/ui/dialog"
import * as sharedDropdownMenu from "@repo/ui/dropdown-menu"
import * as sharedField from "@repo/ui/field"
import * as sharedForm from "@repo/ui/form"
import * as sharedHoverCard from "@repo/ui/hover-card"
import * as sharedInput from "@repo/ui/input"
import * as sharedLabel from "@repo/ui/label"
import * as sharedPopover from "@repo/ui/popover"
import * as sharedProgress from "@repo/ui/progress"
import * as sharedRadioGroup from "@repo/ui/radio-group"
import * as sharedSelect from "@repo/ui/select"
import * as sharedScrollArea from "@repo/ui/scroll-area"
import * as sharedSeparator from "@repo/ui/separator"
import * as sharedSheet from "@repo/ui/sheet"
import * as sharedSkeleton from "@repo/ui/skeleton"
import * as sharedSpinner from "@repo/ui/spinner"
import * as sharedTable from "@repo/ui/table"
import * as sharedTabs from "@repo/ui/tabs"
import * as sharedTextarea from "@repo/ui/textarea"
import * as sharedTooltip from "@repo/ui/tooltip"
import * as startBadge from "../../../apps/wodsmith-start/src/components/ui/badge"
import * as startAlert from "../../../apps/wodsmith-start/src/components/ui/alert"
import * as startAvatar from "../../../apps/wodsmith-start/src/components/ui/avatar"
import * as startBreadcrumb from "../../../apps/wodsmith-start/src/components/ui/breadcrumb"
import * as startButton from "../../../apps/wodsmith-start/src/components/ui/button"
import * as startCard from "../../../apps/wodsmith-start/src/components/ui/card"
import * as startCheckbox from "../../../apps/wodsmith-start/src/components/ui/checkbox"
import * as startCollapsible from "../../../apps/wodsmith-start/src/components/ui/collapsible"
import * as startCn from "../../../apps/wodsmith-start/src/utils/cn"
import * as startDialog from "../../../apps/wodsmith-start/src/components/ui/dialog"
import * as startDropdownMenu from "../../../apps/wodsmith-start/src/components/ui/dropdown-menu"
import * as startField from "../../../apps/wodsmith-start/src/components/ui/field"
import * as startForm from "../../../apps/wodsmith-start/src/components/ui/form"
import * as startHoverCard from "../../../apps/wodsmith-start/src/components/ui/hover-card"
import * as startInput from "../../../apps/wodsmith-start/src/components/ui/input"
import * as startLabel from "../../../apps/wodsmith-start/src/components/ui/label"
import * as startPopover from "../../../apps/wodsmith-start/src/components/ui/popover"
import * as startProgress from "../../../apps/wodsmith-start/src/components/ui/progress"
import * as startRadioGroup from "../../../apps/wodsmith-start/src/components/ui/radio-group"
import * as startSelect from "../../../apps/wodsmith-start/src/components/ui/select"
import * as startScrollArea from "../../../apps/wodsmith-start/src/components/ui/scroll-area"
import * as startSeparator from "../../../apps/wodsmith-start/src/components/ui/separator"
import * as startSheet from "../../../apps/wodsmith-start/src/components/ui/sheet"
import * as startSkeleton from "../../../apps/wodsmith-start/src/components/ui/skeleton"
import * as startSpinner from "../../../apps/wodsmith-start/src/components/ui/spinner"
import * as startTable from "../../../apps/wodsmith-start/src/components/ui/table"
import * as startTabs from "../../../apps/wodsmith-start/src/components/ui/tabs"
import * as startTextarea from "../../../apps/wodsmith-start/src/components/ui/textarea"
import * as startTooltip from "../../../apps/wodsmith-start/src/components/ui/tooltip"

type ModuleExports = Record<string, unknown>

const compatibilityModules: Array<
  [string, ModuleExports, ModuleExports, ModuleExports]
> = [
  ["alert", sharedAlert, startAlert, crewAlert],
  ["avatar", sharedAvatar, startAvatar, crewAvatar],
  ["badge", sharedBadge, startBadge, crewBadge],
  ["breadcrumb", sharedBreadcrumb, startBreadcrumb, crewBreadcrumb],
  ["button", sharedButton, startButton, crewButton],
  ["card", sharedCard, startCard, crewCard],
  ["checkbox", sharedCheckbox, startCheckbox, crewCheckbox],
  ["cn", sharedCn, startCn, crewCn],
  ["collapsible", sharedCollapsible, startCollapsible, crewCollapsible],
  ["dialog", sharedDialog, startDialog, crewDialog],
  ["dropdown-menu", sharedDropdownMenu, startDropdownMenu, crewDropdownMenu],
  ["field", sharedField, startField, crewField],
  ["form", sharedForm, startForm, crewForm],
  ["hover-card", sharedHoverCard, startHoverCard, crewHoverCard],
  ["input", sharedInput, startInput, crewInput],
  ["label", sharedLabel, startLabel, crewLabel],
  ["popover", sharedPopover, startPopover, crewPopover],
  ["progress", sharedProgress, startProgress, crewProgress],
  ["radio-group", sharedRadioGroup, startRadioGroup, crewRadioGroup],
  ["select", sharedSelect, startSelect, crewSelect],
  ["scroll-area", sharedScrollArea, startScrollArea, crewScrollArea],
  ["separator", sharedSeparator, startSeparator, crewSeparator],
  ["sheet", sharedSheet, startSheet, crewSheet],
  ["skeleton", sharedSkeleton, startSkeleton, crewSkeleton],
  ["spinner", sharedSpinner, startSpinner, crewSpinner],
  ["table", sharedTable, startTable, crewTable],
  ["tabs", sharedTabs, startTabs, crewTabs],
  ["textarea", sharedTextarea, startTextarea, crewTextarea],
  ["tooltip", sharedTooltip, startTooltip, crewTooltip],
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
