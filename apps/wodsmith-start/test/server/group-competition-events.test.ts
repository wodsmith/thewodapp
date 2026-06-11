/**
 * Group Competition Events Tests
 *
 * Tests for retroactively grouping existing top-level competition events
 * under a new parent event: validation rules (top-level only, no existing
 * sub-events, no scheduled heats) and the re-parenting transaction
 * (decimal sub-event orders, parent status, top-level renumbering).
 */
import { beforeEach, describe, expect, it } from "vitest"
import { vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"

const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

import { groupCompetitionEvents } from "@/server/group-competition-events"

const TRACK = { id: "ptrk_1", competitionId: "comp_1" }

const baseInput = {
	competitionId: "comp_1",
	organizingTeamId: "team_1",
	trackWorkoutIds: ["tw_a", "tw_b"],
	name: "Event 3: Barbell Complex",
}

function selectedRow(
	id: string,
	trackOrder: number | string,
	overrides: Partial<{
		parentEventId: string | null
		eventStatus: string
		heatStatus: string
		scheme: string
	}> = {},
) {
	return {
		id,
		parentEventId: null,
		trackOrder,
		eventStatus: "draft",
		heatStatus: "draft",
		scheme: "time",
		...overrides,
	}
}

/**
 * Queue results for sequential select chains by intercepting `.from()`.
 * FakeDrizzleDb resolves every select chain to a single shared mock value,
 * so we swap that value each time a new select chain starts.
 */
function queueSelectResults(results: unknown[][]) {
	const chain = mockDb.getChainMock()
	let call = 0
	mockDb.from.mockImplementation(() => {
		const result = results[call]
		if (result === undefined) {
			throw new Error(
				`Unexpected select chain #${call + 1} — only ${results.length} results queued`,
			)
		}
		mockDb.setMockReturnValue(result)
		call++
		return chain
	})
}

beforeEach(() => {
	mockDb.reset()
	mockDb.registerTable("programmingTracksTable")
	mockDb.setMockSingleValue(TRACK)
})

// @lat: [[lat.md/organizer-dashboard#Event Management#Grouping Existing Events Under a Parent]]
describe("groupCompetitionEvents", () => {
	it("throws when the competition track is not found", async () => {
		mockDb.setMockSingleValue(null)

		await expect(groupCompetitionEvents(baseInput)).rejects.toThrow(
			"Competition track not found",
		)
	})

	it("throws when fewer than two unique events are selected", async () => {
		await expect(
			groupCompetitionEvents({
				...baseInput,
				trackWorkoutIds: ["tw_a", "tw_a"],
			}),
		).rejects.toThrow("Select at least two events to group")
	})

	it("throws when more than 99 events are selected", async () => {
		// trackOrder is decimal(6,2): a 100th child would collide with the
		// next top-level slot
		await expect(
			groupCompetitionEvents({
				...baseInput,
				trackWorkoutIds: Array.from({ length: 100 }, (_, i) => `tw_${i}`),
			}),
		).rejects.toThrow("Can't group more than 99 events under one parent")
	})

	it("throws when a selected event is not in this competition", async () => {
		// Only one of the two requested ids exists on this track
		queueSelectResults([[selectedRow("tw_a", 1)]])

		await expect(groupCompetitionEvents(baseInput)).rejects.toThrow(
			"One or more selected events were not found in this competition",
		)
	})

	it("throws when a selected event is already a sub-event", async () => {
		queueSelectResults([
			[
				selectedRow("tw_a", 1.01, { parentEventId: "tw_parent" }),
				selectedRow("tw_b", 2),
			],
		])

		await expect(groupCompetitionEvents(baseInput)).rejects.toThrow(
			"Sub-events can't be grouped",
		)
	})

	it("throws when a selected event already has sub-events", async () => {
		queueSelectResults([
			[selectedRow("tw_a", 1), selectedRow("tw_b", 2)],
			// children check returns an existing sub-event
			[{ id: "tw_existing_child" }],
		])

		await expect(groupCompetitionEvents(baseInput)).rejects.toThrow(
			"Events that already have sub-events can't be grouped",
		)
	})

	it("throws when a selected event already has heats scheduled", async () => {
		queueSelectResults([
			[selectedRow("tw_a", 1), selectedRow("tw_b", 2)],
			// no existing children
			[],
			// heats check returns a heat
			[{ id: "heat_1" }],
		])

		await expect(groupCompetitionEvents(baseInput)).rejects.toThrow(
			"already have heats scheduled",
		)
	})

	it("creates a parent and re-parents the selected events with decimal orders", async () => {
		queueSelectResults([
			// selected events (decimal columns come back as strings)
			[
				selectedRow("tw_b", "4.00", { scheme: "load" }),
				selectedRow("tw_a", "2.00"),
			],
			[], // children check
			[], // heats check
			// top-level renumber: parent took slot 2, tw_b left a gap at 4
			[
				{ id: "tw_1", trackOrder: "1.00" },
				{ id: "tw_parent_new", trackOrder: "2.00" },
				{ id: "tw_3", trackOrder: "3.00" },
				{ id: "tw_5", trackOrder: "5.00" },
			],
			[], // children of renumbered tw_5
		])

		const result = await groupCompetitionEvents(baseInput)

		expect(result.trackWorkoutId).toBeTruthy()
		expect(result.workoutId).toMatch(/^workout_/)

		const chain = mockDb.getChainMock()

		// Parent container workout + parent track workout inserted
		const insertedValues = chain.values.mock.calls.map((c) => c[0])
		expect(insertedValues).toHaveLength(2)
		expect(insertedValues[0]).toMatchObject({
			id: result.workoutId,
			name: "Event 3: Barbell Complex",
			teamId: "team_1",
			scope: "private",
			// scheme comes from the earliest selected event (tw_a at order 2)
			scheme: "time",
			scoreType: null,
		})
		expect(insertedValues[1]).toMatchObject({
			id: result.trackWorkoutId,
			trackId: TRACK.id,
			workoutId: result.workoutId,
			// parent takes the earliest selected event's slot
			trackOrder: 2,
			parentEventId: null,
			// not every grouped event is published, so the parent stays draft
			eventStatus: "draft",
			heatStatus: "draft",
		})

		// Selected events re-parented in current order, then tw_5 renumbered 5 -> 4
		const setCalls = chain.set.mock.calls.map((c) => c[0])
		expect(setCalls[0]).toMatchObject({
			parentEventId: result.trackWorkoutId,
			trackOrder: 2.01,
			// draft parent cascades to children so none stay publicly visible
			eventStatus: "draft",
		})
		expect(setCalls[1]).toMatchObject({
			parentEventId: result.trackWorkoutId,
			trackOrder: 2.02,
			eventStatus: "draft",
		})
		expect(setCalls[2]).toMatchObject({ trackOrder: 4 })
		expect(setCalls).toHaveLength(3)
	})

	it("publishes the parent when every grouped event is already published", async () => {
		queueSelectResults([
			[
				selectedRow("tw_a", 1, {
					eventStatus: "published",
					heatStatus: "published",
				}),
				selectedRow("tw_b", 2, {
					eventStatus: "published",
					heatStatus: "published",
				}),
			],
			[], // children check
			[], // heats check
			[], // top-level renumber
		])

		const result = await groupCompetitionEvents(baseInput)

		const chain = mockDb.getChainMock()
		const parentTrackWorkout = chain.values.mock.calls[1]?.[0]
		expect(parentTrackWorkout).toMatchObject({
			id: result.trackWorkoutId,
			eventStatus: "published",
			heatStatus: "published",
		})
	})
})
