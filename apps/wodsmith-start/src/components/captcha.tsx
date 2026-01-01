"use client"

import { Turnstile } from "@marsidev/react-turnstile"
import type { ComponentProps } from "react"
import { FormMessage } from "./ui/form"

type Props = Omit<ComponentProps<typeof Turnstile>, "siteKey"> & {
	validationError?: string
	isTurnstileEnabled: boolean
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ""

export function Captcha({
	validationError,
	isTurnstileEnabled,
	...props
}: Props) {
	// Don't render if turnstile is disabled or if the site key is missing
	if (!isTurnstileEnabled || !siteKey) {
		return null
	}

	return (
		<>
			<Turnstile
				options={{
					size: "flexible",
					language: "auto",
				}}
				{...props}
				siteKey={siteKey}
			/>

			{validationError && (
				<FormMessage className="text-red-500 mt-2">
					{validationError}
				</FormMessage>
			)}
		</>
	)
}
