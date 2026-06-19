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

	it("returns an empty array when there are no template assets", () => {
		expect(
			selectTemplateAssetsMissingByTitle([], [{ title: "Movement Standards" }]),
		).toEqual([])
	})

	it("returns an empty array when all template assets already exist", () => {
		const templateAssets = [{ id: "template-existing", title: "Scorecard" }]
		const existingCompetitionAssets = [{ title: "scorecard" }]

		expect(
			selectTemplateAssetsMissingByTitle(
				templateAssets,
				existingCompetitionAssets,
			),
		).toEqual([])
	})

	it("deduplicates empty and whitespace-only titles consistently", () => {
		const templateAssets = [
			{ id: "template-empty", title: "" },
			{ id: "template-spaces", title: "   " },
			{ id: "template-tabs", title: "\t\n" },
			{ id: "template-valid", title: "Volunteer Briefing" },
		]

		expect(selectTemplateAssetsMissingByTitle(templateAssets, [])).toEqual([
			{ id: "template-empty", title: "" },
			{ id: "template-valid", title: "Volunteer Briefing" },
		])
	})

	it("deduplicates multiple duplicates with varying case and whitespace", () => {
		const templateAssets = [
			{ id: "template-first", title: " Scorecard " },
			{ id: "template-second", title: "scorecard" },
			{ id: "template-third", title: "SCORECARD" },
			{ id: "template-standards", title: "Movement Standards" },
		]

		expect(selectTemplateAssetsMissingByTitle(templateAssets, [])).toEqual([
			{ id: "template-first", title: " Scorecard " },
			{ id: "template-standards", title: "Movement Standards" },
		])
	})
})
