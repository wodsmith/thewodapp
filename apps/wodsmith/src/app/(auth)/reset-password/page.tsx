import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getResetTokenKey } from "@/utils/auth-utils"
import ResetPasswordClientComponent from "./reset-password.client"

export const metadata: Metadata = {
	title: "Reset Password",
	description: "Set a new password for your account",
}

export default async function ResetPasswordPage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string }>
}) {
	const token = (await searchParams).token

	if (!token) {
		return notFound()
	}

	const { env } = getCloudflareContext()

	if (!env?.NEXT_INC_CACHE_KV) {
		throw new Error("Can't connect to KV store")
	}

	const resetTokenStr = await env.NEXT_INC_CACHE_KV.get(getResetTokenKey(token))

	if (!resetTokenStr) {
		return notFound()
	}

	return <ResetPasswordClientComponent />
}
