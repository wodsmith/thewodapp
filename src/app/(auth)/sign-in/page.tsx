import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { getSessionFromCookie } from "@/utils/auth"
import SignInClientPage from "./sign-in.client"

export const metadata: Metadata = {
	title: "Sign In",
	description: "Sign in to your account",
}

const SignInPage = async ({
	searchParams,
}: {
	searchParams: Promise<{ redirect?: string }>
}) => {
	const { redirect: redirectParam } = await searchParams
	const session = await getSessionFromCookie()
	const redirectPath =
		redirectParam ?? (REDIRECT_AFTER_SIGN_IN as unknown as string)

	if (session) {
		return redirect(redirectPath)
	}

	return <SignInClientPage redirectPath={redirectPath} />
}

export default SignInPage
