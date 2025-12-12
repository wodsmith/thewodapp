"use client"

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
	theme: Theme
	resolvedTheme: "light" | "dark"
	setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = "theme"

/**
 * Get the system's preferred color scheme
 */
function getSystemTheme(): "light" | "dark" {
	if (typeof window === "undefined") return "dark"
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light"
}

/**
 * Get the stored theme from localStorage
 */
function getStoredTheme(): Theme {
	if (typeof window === "undefined") return "system"
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored === "light" || stored === "dark" || stored === "system") {
			return stored
		}
	} catch {
		// localStorage might be unavailable
	}
	return "system"
}

/**
 * Apply theme class to document element
 */
function applyTheme(theme: "light" | "dark") {
	if (typeof document === "undefined") return
	const root = document.documentElement
	root.classList.remove("light", "dark")
	root.classList.add(theme)
}

interface ThemeProviderProps {
	children: React.ReactNode
	defaultTheme?: Theme
	attribute?: string
	enableSystem?: boolean
}

/**
 * Theme provider that manages light/dark mode.
 * Compatible replacement for next-themes in TanStack Start/Vite apps.
 */
export function ThemeProvider({
	children,
	defaultTheme = "system",
}: ThemeProviderProps) {
	const [theme, setThemeState] = useState<Theme>(() => {
		// SSR-safe: start with default, hydrate on client
		if (typeof window === "undefined") return defaultTheme
		return getStoredTheme()
	})

	const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
		if (typeof window === "undefined") return "dark"
		const stored = getStoredTheme()
		return stored === "system" ? getSystemTheme() : stored
	})

	// Handle theme changes
	const setTheme = useCallback((newTheme: Theme) => {
		setThemeState(newTheme)
		try {
			localStorage.setItem(STORAGE_KEY, newTheme)
		} catch {
			// localStorage might be unavailable
		}
	}, [])

	// Update resolved theme and apply to DOM
	useEffect(() => {
		const resolved = theme === "system" ? getSystemTheme() : theme
		setResolvedTheme(resolved)
		applyTheme(resolved)
	}, [theme])

	// Listen for system theme changes
	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

		const handleChange = () => {
			if (theme === "system") {
				const resolved = getSystemTheme()
				setResolvedTheme(resolved)
				applyTheme(resolved)
			}
		}

		mediaQuery.addEventListener("change", handleChange)
		return () => mediaQuery.removeEventListener("change", handleChange)
	}, [theme])

	// Hydrate from localStorage on mount
	useEffect(() => {
		const stored = getStoredTheme()
		if (stored !== theme) {
			setThemeState(stored)
		}
	}, [])

	const value = useMemo(
		() => ({ theme, resolvedTheme, setTheme }),
		[theme, resolvedTheme, setTheme]
	)

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Hook to access theme context.
 * Drop-in replacement for next-themes useTheme hook.
 */
export function useTheme() {
	const context = useContext(ThemeContext)
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider")
	}
	return context
}
