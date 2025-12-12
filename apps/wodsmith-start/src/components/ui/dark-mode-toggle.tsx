"use client"

import { Moon, Sun } from "lucide-react"
import * as React from "react"

import { useTheme } from "~/components/theme-provider"
import { Button } from "~/components/ui/button"

export function DarkModeToggle() {
	const { setTheme, theme } = useTheme()
	const [mounted, setMounted] = React.useState(false)

	// useEffect only runs on the client, so now we can safely show the UI
	React.useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted) {
		// Return a button with the Sun icon as default to prevent layout shift
		return (
			<Button variant="outline" size="icon" disabled>
				<Sun className="h-[1.2rem] w-[1.2rem]" />
				<span className="sr-only">Toggle theme</span>
			</Button>
		)
	}

	return (
		<Button
			variant="outline"
			size="icon"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
		>
			<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	)
}
