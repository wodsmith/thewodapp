"use client"

import { Turnstile } from "@marsidev/react-turnstile"
import type { ComponentProps } from "react"
import { FormMessage } from "./ui/form"

type Props = Omit<ComponentProps<typeof Turnstile>, "siteKey"> & {
	validationError?: string
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ""

export function Captcha({ validationError, ...props }: Props) {
	// Don't render if the site key is missing - CAPTCHA is only enabled
	// when VITE_TURNSTILE_SITE_KEY is configured
	if (!siteKey) {
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
