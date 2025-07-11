import {
	createCoach,
	deleteCoach,
	getCoachById,
	getCoachesByTeam,
	updateCoach,
	createCoachBlackoutDate,
	deleteCoachBlackoutDate,
	createCoachRecurringUnavailability,
	deleteCoachRecurringUnavailability,
} from "@/actions/coach-actions"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
	request: Request,
	{ params }: { params: { teamId: string; coachId: string[] } },
) {
	const { user } = await auth()
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 })
	}

	const teamId = params.teamId
	if (!teamId) {
		return new NextResponse("Team ID is required", { status: 400 })
	}

	const coachId = params.coachId?.[0]

	if (coachId) {
		const coach = await getCoachById({ id: coachId, teamId })
		if (coach) {
			return NextResponse.json(coach)
		} else {
			return new NextResponse("Coach not found", { status: 404 })
		}
	} else {
		const coaches = await getCoachesByTeam({ teamId })
		return NextResponse.json(coaches)
	}
}

export async function POST(
	request: Request,
	{ params }: { params: { teamId: string } },
) {
	const { user } = await auth()
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 })
	}

	const teamId = params.teamId
	if (!teamId) {
		return new NextResponse("Team ID is required", { status: 400 })
	}

	const body = await request.json()
	// Determine action based on path or body content
	if (body.type === "blackoutDate") {
		const result = await createCoachBlackoutDate({
			coachId: body.coachId,
			startDate: new Date(body.startDate),
			endDate: new Date(body.endDate),
			reason: body.reason,
		})
		if (result) {
			return NextResponse.json(result, { status: 201 })
		} else {
			return new NextResponse("Failed to create blackout date", { status: 400 })
		}
	} else if (body.type === "recurringUnavailability") {
		const result = await createCoachRecurringUnavailability({
			coachId: body.coachId,
			dayOfWeek: body.dayOfWeek,
			startTime: body.startTime,
			endTime: body.endTime,
			description: body.description,
		})
		if (result) {
			return NextResponse.json(result, { status: 201 })
		} else {
			return new NextResponse("Failed to create recurring unavailability", {
				status: 400,
			})
		}
	} else {
		// Assume it's a new coach creation
		const result = await createCoach({ ...body, teamId })
		if (result) {
			return NextResponse.json(result, { status: 201 })
		} else {
			return new NextResponse("Failed to create coach", { status: 400 })
		}
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: { teamId: string; coachId: string[] } },
) {
	const { user } = await auth()
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 })
	}

	const teamId = params.teamId
	if (!teamId) {
		return new NextResponse("Team ID is required", { status: 400 })
	}

	const coachId = params.coachId?.[0]
	if (!coachId) {
		return new NextResponse("Coach ID is required", { status: 400 })
	}

	const body = await request.json()
	const result = await updateCoach({ id: coachId, teamId, ...body })

	if (result) {
		return NextResponse.json(result)
	} else {
		return new NextResponse("Failed to update coach", { status: 400 })
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: { teamId: string; coachId: string[] } },
) {
	const { user } = await auth()
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 })
	}

	const teamId = params.teamId
	if (!teamId) {
		return new NextResponse("Team ID is required", { status: 400 })
	}

	const coachId = params.coachId?.[0]
	if (!coachId) {
		return new NextResponse("Coach ID is required", { status: 400 })
	}

	const body = await request.json()
	// Determine action based on path or body content
	if (body.type === "blackoutDate") {
		const result = await deleteCoachBlackoutDate({
			id: coachId,
			coachId: body.coachId,
		})
		if (result) {
			return new NextResponse(null, { status: 204 })
		} else {
			return new NextResponse("Failed to delete blackout date", { status: 400 })
		}
	} else if (body.type === "recurringUnavailability") {
		const result = await deleteCoachRecurringUnavailability({
			id: coachId,
			coachId: body.coachId,
		})
		if (result) {
			return new NextResponse(null, { status: 204 })
		} else {
			return new NextResponse("Failed to delete recurring unavailability", {
				status: 400,
			})
		}
	} else {
		// Assume it's a coach deletion
		const result = await deleteCoach({ id: coachId, teamId })
		if (result) {
			return new NextResponse(null, { status: 204 })
		} else {
			return new NextResponse("Failed to delete coach", { status: 400 })
		}
	}
}
