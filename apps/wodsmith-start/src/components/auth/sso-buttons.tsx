"use client"

import { Button } from "~/components/ui/button"

interface SSOButtonsProps {
	isSignIn?: boolean
}

export default function SSOButtons({ isSignIn = false }: SSOButtonsProps) {
	const handleGoogleAuth = () => {
		// Redirect to Google OAuth initiation route
		window.location.href = "/sso/google"
	}

	return (
		<>
			<Button onClick={handleGoogleAuth} variant="outline" className="w-full">
				SIGN {isSignIn ? "IN" : "UP"} WITH GOOGLE
			</Button>
		</>
	)
}
