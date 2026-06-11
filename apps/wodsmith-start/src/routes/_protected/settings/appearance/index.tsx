"use client"

import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle2, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const THEME_KEY = "wodsmith-theme"

type Theme = "light" | "dark"

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === "dark" || stored === "light") return stored
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches
  return prefersDark ? "dark" : "light"
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export const Route = createFileRoute("/_protected/settings/appearance/")({
  component: SettingsAppearancePage,
})

function SettingsAppearancePage() {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const initial = getInitialTheme()
    setTheme(initial)
    applyTheme(initial)
  }, [])

  const handleSelect = (next: Theme) => {
    setTheme(next)
    applyTheme(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, next)
    }
  }

  const options = [
    { value: "light" as Theme, label: "Light", icon: Sun },
    { value: "dark" as Theme, label: "Dark", icon: Moon },
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* Page header */}
      <div>
        <div className="text-xs font-bold tracking-[0.18em] uppercase text-primary mb-1.5">
          Appearance
        </div>
        <h1 className="text-3xl font-mono font-bold tracking-tight">
          Appearance
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl">
          Tune how WODsmith looks. Changes apply instantly to your account on
          this device.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {options.map((opt) => {
            const active = opt.value === theme
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={[
                  "rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40",
                  active ? "border-primary/40 ring-2 ring-primary/40" : "",
                ].join(" ")}
                aria-pressed={active}
              >
                <div
                  className={[
                    "h-20 rounded-lg border flex items-center justify-between p-3",
                    opt.value === "dark"
                      ? "bg-zinc-900 border-zinc-700 text-zinc-50"
                      : "bg-white border-zinc-200 text-zinc-900",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-1">
                    <div className="h-1.5 w-10 rounded-full bg-current opacity-60" />
                    <div className="h-1.5 w-6 rounded-full bg-current opacity-30" />
                  </div>
                  <div className="h-3 w-3 rounded-full bg-orange-500" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono font-bold text-sm flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </span>
                  {active && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              </button>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
