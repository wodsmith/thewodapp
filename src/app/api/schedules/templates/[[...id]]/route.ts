import {
	createScheduleTemplate,
	deleteScheduleTemplate,
	getScheduleTemplateById,
	getScheduleTemplatesByTeam,
	updateScheduleTemplate,
	createScheduleTemplateClass,
	updateScheduleTemplateClass,
	deleteScheduleTemplateClass,
} from "@/actions/schedule-template-actions"
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

	const templateId = params.id?.[0]

	if (templateId) {
		const template = await getScheduleTemplateById({ id: templateId, teamId })
		if (template) {
			return NextResponse.json(template)
		} else {
			return new NextResponse("Schedule Template not found", { status: 404 })
		}
	} else {
		const templates = await getScheduleTemplatesByTeam({ teamId })
		return NextResponse.json(templates)
	}
}

export async function POST(
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

	const body = await request.json()
	const templateId = params.id?.[0]

	if (templateId) {
		// Assume it's a class creation for a specific template
		const result = await createScheduleTemplateClass({ templateId, ...body })
		if (result) {
			return NextResponse.json(result, { status: 201 })
		} else {
			return new NextResponse("Failed to create schedule template class", {
				status: 400,
			})
		}
	} else {
		// Assume it's a new schedule template creation
		const result = await createScheduleTemplate({ teamId, name: body.name })
		if (result) {
			return NextResponse.json(result, { status: 201 })
		} else {
			return new NextResponse("Failed to create schedule template", {
				status: 400,
			})
		}
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

	const templateId = params.id?.[0]
	if (!templateId) {
		return new NextResponse("Template ID is required", { status: 400 })
	}

	const body = await request.json()
	const classId = params.id?.[1] // For updating a specific class within a template

	if (classId) {
		const result = await updateScheduleTemplateClass({
			id: classId,
			templateId,
			...body,
		})
		if (result) {
			return NextResponse.json(result)
		} else {
			return new NextResponse("Failed to update schedule template class", {
				status: 400,
			})
		}
	} else {
		const result = await updateScheduleTemplate({
			id: templateId,
			teamId,
			name: body.name,
		})
		if (result) {
			return NextResponse.json(result)
		} else {
			return new NextResponse("Failed to update schedule template", {
				status: 400,
			})
		}
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

	const templateId = params.id?.[0]
	if (!templateId) {
		return new NextResponse("Template ID is required", { status: 400 })
	}

	const classId = params.id?.[1] // For deleting a specific class within a template

	if (classId) {
		const result = await deleteScheduleTemplateClass({
			id: classId,
			templateId,
		})
		if (result) {
			return new NextResponse(null, { status: 204 })
		} else {
			return new NextResponse("Failed to delete schedule template class", {
				status: 400,
			})
		}
	} else {
		const result = await deleteScheduleTemplate({ id: templateId, teamId })
		if (result) {
			return new NextResponse(null, { status: 204 })
		} else {
			return new NextResponse("Failed to delete schedule template", {
				status: 400,
			})
		}
	}
}
