import { getCloudflareContext } from "@opennextjs/cloudflare"
import { NextResponse } from "next/server"
import { getSessionFromCookie } from "@/utils/auth"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

const PURPOSE_CONFIG: Record<
	string,
	{ maxSizeMb: number; pathPrefix: string }
> = {
	"competition-profile": { maxSizeMb: 5, pathPrefix: "competitions/profiles" },
	"competition-banner": { maxSizeMb: 5, pathPrefix: "competitions/banners" },
	"athlete-profile": { maxSizeMb: 2, pathPrefix: "athletes/profiles" },
	"athlete-cover": { maxSizeMb: 5, pathPrefix: "athletes/covers" },
	"sponsor-logo": { maxSizeMb: 2, pathPrefix: "sponsors/logos" },
}

export async function POST(request: Request) {
	const session = await getSessionFromCookie()
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
	}

	const formData = await request.formData()
	const file = formData.get("file") as File | null
	const purpose = formData.get("purpose") as string | null
	const entityId = formData.get("entityId") as string | null

	if (!file) {
		return NextResponse.json({ error: "No file provided" }, { status: 400 })
	}

	if (!purpose || !PURPOSE_CONFIG[purpose]) {
		return NextResponse.json(
			{ error: "Invalid or missing purpose" },
			{ status: 400 },
		)
	}

	const config = PURPOSE_CONFIG[purpose]
	const maxSizeBytes = config.maxSizeMb * 1024 * 1024

	if (file.size > maxSizeBytes) {
		return NextResponse.json(
			{ error: `File too large. Maximum size is ${config.maxSizeMb}MB` },
			{ status: 400 },
		)
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		return NextResponse.json(
			{ error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
			{ status: 400 },
		)
	}

	const extension = file.name.split(".").pop() || "jpg"
	const timestamp = Date.now()
	const filename = `${timestamp}.${extension}`
	const key = entityId
		? `${config.pathPrefix}/${entityId}/${filename}`
		: `${config.pathPrefix}/${session.user.id}/${filename}`

	const { env } = getCloudflareContext()

	await env.R2_BUCKET.put(key, await file.arrayBuffer(), {
		httpMetadata: {
			contentType: file.type,
		},
		customMetadata: {
			uploadedBy: session.user.id,
			purpose,
			originalFilename: file.name,
		},
	})

	const publicUrl = env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : key

	return NextResponse.json({
		url: publicUrl,
		key,
	})
}
