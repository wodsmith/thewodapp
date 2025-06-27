import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { getSessionFromCookie } from "@/utils/auth"
import SignUpClientComponent from "./sign-up.client"

export const metadata: Metadata = {
	title: "Sign Up",
	description: "Create a new account",
}

const SignUpPage = async ({
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

	return <SignUpClientComponent redirectPath={redirectPath} />
}

export default SignUpPage
