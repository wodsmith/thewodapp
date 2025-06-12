import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { getSessionFromCookie } from "@/utils/auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import GoogleCallbackClientComponent from "./google-callback.client"

export const metadata: Metadata = {
	title: "Sign in with Google",
	description: "Complete your sign in with Google",
}

export default async function GoogleCallbackPage() {
	const session = await getSessionFromCookie()

	if (session) {
		return redirect(REDIRECT_AFTER_SIGN_IN)
	}

	return <GoogleCallbackClientComponent />
}
