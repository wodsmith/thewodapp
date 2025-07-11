import {
	createSkill,
	deleteSkill,
	getSkillsByTeam,
	updateSkill,
} from "@/actions/gym-setup-actions"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
	request: Request,
	{ params }: { params: { id: string[] } },
) {
	const { user } = await auth()
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 })
	}

	const teamId = request.headers.get("x-team-id")
	if (!teamId) {
		return new NextResponse("Team ID is required", { status: 400 })
	}

	if (params.id && params.id.length > 0) {
		// Get single skill by ID (not implemented in actions yet, but can be added)
		return new NextResponse(
			"Getting single skill by ID is not yet implemented",
			{ status: 501 },
		)
	} else {
		// Get all skills for a team
		const result = await getSkillsByTeam({ teamId })
		if (result.success) {
			return NextResponse.json(result.data)
		} else {
			return new NextResponse(result.error, { status: 500 })
		}
	}
}

export async function POST(request: Request) {
	const { user } = await auth()
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 })
	}

	const teamId = request.headers.get("x-team-id")
	if (!teamId) {
		return new NextResponse("Team ID is required", { status: 400 })
	}

	const body = await request.json()
	const result = await createSkill({ teamId, name: body.name })

	if (result.success) {
		return NextResponse.json(result.data, { status: 201 })
	} else {
		return new NextResponse(result.error, { status: 400 })
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: { id: string[] } },
) {
	const { user } = await auth()
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 })
	}

	const teamId = request.headers.get("x-team-id")
	if (!teamId) {
		return new NextResponse("Team ID is required", { status: 400 })
	}

	const skillId = params.id?.[0]
	if (!skillId) {
		return new NextResponse("Skill ID is required", { status: 400 })
	}

	const body = await request.json()
	const result = await updateSkill({ id: skillId, teamId, name: body.name })

	if (result.success) {
		return NextResponse.json(result.data)
	} else {
		return new NextResponse(result.error, { status: 400 })
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: { id: string[] } },
) {
	const { user } = await auth()
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 })
	}

	const teamId = request.headers.get("x-team-id")
	if (!teamId) {
		return new NextResponse("Team ID is required", { status: 400 })
	}

	const skillId = params.id?.[0]
	if (!skillId) {
		return new NextResponse("Skill ID is required", { status: 400 })
	}

	const result = await deleteSkill({ id: skillId, teamId })

	if (result.success) {
		return new NextResponse(null, { status: 204 })
	} else {
		return new NextResponse(result.error, { status: 400 })
	}
}
