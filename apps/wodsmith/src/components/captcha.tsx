"use client"

import dynamic from "next/dynamic"
import type { ComponentProps } from "react"
import { useConfigStore } from "@/state/config"
import { FormMessage } from "./ui/form"

const Turnstile = dynamic(
	() => import("@marsidev/react-turnstile").then((mod) => mod.Turnstile),
	{
		ssr: false,
	},
)

type Props = Omit<ComponentProps<typeof Turnstile>, "siteKey"> & {
	validationError?: string
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""

export const Captcha = ({ validationError, ...props }: Props) => {
	const { isTurnstileEnabled } = useConfigStore()

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
