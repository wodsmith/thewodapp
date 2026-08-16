import { describe, expect, expectTypeOf, it } from "vitest"
import {
	COMPETITION_TYPE_REGISTRY,
	type CompetitionCapability,
	type SelectableCompetitionTypeId,
	competitionCan,
	competitionTypeOptions,
	isSelectableCompetitionTypeValue,
	isCompetitionTypeValue,
	resultsEntryMode,
	resultsNavLabel,
	isSelectableType,
	leaderboardVariant,
	selectableCompetitionTypeOptions,
	selectableCompetitionTypes,
} from "@/lib/competitions/capabilities"

const CAPABILITIES: CompetitionCapability[] = [
	"videoSubmissions",
	"submissionWindows",
	"optInResultPublishing",
	"heatScheduling",
	"dayOfCheckIn",
	"physicalVenue",
	"volunteerScheduling",
	"organizerEntersResults",
]

const EXPECTED = {
	"in-person": {
		videoSubmissions: false,
		submissionWindows: false,
		optInResultPublishing: false,
		heatScheduling: true,
		dayOfCheckIn: true,
		physicalVenue: true,
		volunteerScheduling: true,
		organizerEntersResults: true,
		leaderboardVariant: "standard",
		selectableOnCreate: true,
	},
	benchmark: {
		videoSubmissions: false,
		submissionWindows: false,
		optInResultPublishing: false,
		heatScheduling: false,
		dayOfCheckIn: false,
		physicalVenue: false,
		volunteerScheduling: false,
		organizerEntersResults: true,
		leaderboardVariant: "standard",
		selectableOnCreate: false,
	},
	online: {
		videoSubmissions: true,
		submissionWindows: true,
		optInResultPublishing: true,
		heatScheduling: false,
		dayOfCheckIn: false,
		physicalVenue: false,
		volunteerScheduling: false,
		organizerEntersResults: false,
		leaderboardVariant: "online",
		selectableOnCreate: true,
	},
} as const

describe("competition type capabilities", () => {
	// @lat: [[competition-type-capabilities#Capability Truth Table Test#Current Type Matrix]]
	it("pins every registered competition type to the existing behavior table", () => {
		for (const [type, expected] of Object.entries(EXPECTED)) {
			for (const capability of CAPABILITIES) {
				expect(competitionCan(type, capability), `${type}:${capability}`).toBe(
					expected[capability],
				)
			}

			expect(leaderboardVariant(type)).toBe(expected.leaderboardVariant)
			expect(isSelectableType(type)).toBe(expected.selectableOnCreate)
		}
	})

	// @lat: [[competition-type-capabilities#Capability Truth Table Test#Registry Metadata Alignment]]
	it("keeps registry metadata aligned with the supported type identities", () => {
		expect(Object.keys(COMPETITION_TYPE_REGISTRY).sort()).toEqual([
			"benchmark",
			"in-person",
			"online",
		])

		for (const [type, definition] of Object.entries(COMPETITION_TYPE_REGISTRY)) {
			expect(definition.id).toBe(type)
			expect(definition.label).toEqual(expect.any(String))
			expect(definition.capabilities).toBeInstanceOf(Set)
		}
	})

	// @lat: [[competition-type-capabilities#Capability Truth Table Test#Unknown Type Fallback]]
	it("falls back safely for unknown competition types", () => {
		for (const capability of CAPABILITIES) {
			expect(competitionCan("unsupported", capability)).toBe(false)
		}

		expect(leaderboardVariant("unsupported")).toBe("standard")
		expect(isSelectableType("unsupported")).toBe(false)
	})

	// @lat: [[competition-type-capabilities#Create Picker Selectability Test]]
	it("keeps benchmark editable while excluding it from the create picker", () => {
		const registeredOptions = competitionTypeOptions()
		const selectableTypes = selectableCompetitionTypes()
		const pickerOptions = selectableCompetitionTypeOptions()

		expectTypeOf<SelectableCompetitionTypeId>().toEqualTypeOf<
			"in-person" | "online"
		>()

		expect(isCompetitionTypeValue("benchmark")).toBe(true)
		expect(isSelectableCompetitionTypeValue("benchmark")).toBe(false)
		expect(isCompetitionTypeValue("unsupported")).toBe(false)
		expect(isCompetitionTypeValue(null)).toBe(false)
		expect(isSelectableCompetitionTypeValue(null)).toBe(false)

		expect(registeredOptions).toContainEqual({
			id: "benchmark",
			label: "Benchmark",
			description: "Perpetual athlete benchmark tracking",
			displayLabel: "Benchmark - Perpetual athlete benchmark tracking",
		})
		expect(selectableTypes.map((type) => type.id)).toEqual([
			"in-person",
			"online",
		])
		for (const type of selectableTypes) {
			expect(isSelectableType(type.id)).toBe(true)
			expect(isSelectableCompetitionTypeValue(type.id)).toBe(true)
		}

		expect(pickerOptions).toEqual([
			{
				id: "in-person",
				label: "In-Person",
				description: "Traditional venue-based competition",
				displayLabel: "In-Person - Traditional venue-based competition",
			},
			{
				id: "online",
				label: "Online",
				description: "Virtual competition with video submissions",
				displayLabel: "Online - Virtual competition with video submissions",
			},
		])
	})

	// @lat: [[competition-type-capabilities#Results Entry and Sidebar Gates Test#Registry Results Mode Labels]]
	it("derives results-entry mode and nav labels from organizer-entered-results capability", () => {
		expect(resultsEntryMode("in-person")).toBe("organizer-entered")
		expect(resultsNavLabel("in-person")).toBe("Results")

		expect(resultsEntryMode("online")).toBe("athlete-submitted")
		expect(resultsNavLabel("online")).toBe("Submissions")

		expect(resultsEntryMode("benchmark")).toBe("organizer-entered")
		expect(resultsNavLabel("benchmark")).toBe("Results")
	})
})
