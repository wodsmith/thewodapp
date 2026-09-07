export type Theme = "light" | "dark"

/** Resolve the same preference used by the root's pre-paint script. */
export function getTheme(): Theme {
  if (typeof window === "undefined") return "light"
  const stored = window.localStorage.getItem("theme")
  if (stored === "light" || stored === "dark") return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

/** Persist the preference for both browser startup and server rendering. */
export function saveTheme(theme: Theme) {
  window.localStorage.setItem("theme", theme)
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  // biome-ignore lint/suspicious/noDocumentCookie: SSR reads the same preference cookie
  document.cookie = `theme=${theme}; path=/; expires=${expires}; SameSite=Lax${secure}`
  applyTheme(theme)
}
