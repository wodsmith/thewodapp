import { describe, expect, it } from "vitest"
import { selectTemplateAssetsMissingByTitle } from "@/lib/series-template-asset-sync"

describe("selectTemplateAssetsMissingByTitle", () => {
	it("selects quick links and judging sheets that are newly added before resync", () => {
		const templateAssets = [
			{ id: "template-existing", title: "Movement Standards" },
			{ id: "template-new", title: "Heat Flow" },
		]
		const existingCompetitionAssets = [
			{ title: "movement standards" },
		]

		expect(
			selectTemplateAssetsMissingByTitle(
				templateAssets,
				existingCompetitionAssets,
			),
		).toEqual([{ id: "template-new", title: "Heat Flow" }])
	})

	it("deduplicates by trimmed case-insensitive title during initial sync", () => {
		const templateAssets = [
			{ id: "template-first", title: "Scorecard" },
			{ id: "template-duplicate", title: " scorecard " },
		]

		expect(selectTemplateAssetsMissingByTitle(templateAssets, [])).toEqual([
			{ id: "template-first", title: "Scorecard" },
		])
	})
})
