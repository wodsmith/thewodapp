import { NextResponse } from "next/server"
import { getConfig } from "@/flags"
import { tryCatch } from "@/lib/try-catch"
import { getSessionFromCookie } from "@/utils/auth"

export async function GET() {
	const { data: session, error } = await tryCatch(getSessionFromCookie())
	const config = await getConfig()

	const headers = new Headers()
	headers.set(
		"Cache-Control",
		"no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
	)
	headers.set("Pragma", "no-cache")
	headers.set("Expires", "0")

	if (error) {
		return NextResponse.json(
			{
				session: null,
				config,
			},
			{
				headers,
			},
		)
	}

	return NextResponse.json(
		{
			session,
			config,
		},
		{
			headers,
		},
	)
}
