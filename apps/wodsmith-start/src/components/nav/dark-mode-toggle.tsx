"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type Theme = "light" | "dark"

export function DarkModeToggle() {
	const [theme, setTheme] = useState<Theme>("light")
	const [mounted, setMounted] = useState(false)

	// Load theme from localStorage on mount
	useEffect(() => {
		const savedTheme = localStorage.getItem("theme") as Theme | null
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches

		const initialTheme = savedTheme || (prefersDark ? "dark" : "light")
		setTheme(initialTheme)
		applyTheme(initialTheme)
		setMounted(true)
	}, [])

	const applyTheme = (newTheme: Theme) => {
		const root = document.documentElement
		if (newTheme === "dark") {
			root.classList.add("dark")
		} else {
			root.classList.remove("dark")
		}
	}

	const toggleTheme = () => {
		const newTheme = theme === "dark" ? "light" : "dark"
		setTheme(newTheme)
		localStorage.setItem("theme", newTheme)
		applyTheme(newTheme)
	}

	// Prevent layout shift during SSR/hydration by showing a default icon
	if (!mounted) {
		return (
			<Button variant="outline" size="icon" disabled aria-label="Toggle theme">
				<Sun className="h-[1.2rem] w-[1.2rem]" />
				<span className="sr-only">Toggle theme</span>
			</Button>
		)
	}

	return (
		<Button
			variant="outline"
			size="icon"
			onClick={toggleTheme}
			aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
		>
			<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	)
}
