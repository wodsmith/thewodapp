"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { logoutFn } from "@/server-fns/auth-fns"

interface LogoutButtonProps {
  showText?: boolean
}

export default function LogoutButton({ showText = false }: LogoutButtonProps) {
  const handleLogout = async () => {
    try {
      await logoutFn()
      window.location.href = "/sign-in"
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  if (showText) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 hover:text-primary"
      >
        <LogOut className="h-5 w-5" />
        <span>Log out</span>
      </button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleLogout}
      aria-label="Log out"
    >
      <LogOut className="h-5 w-5" />
    </Button>
  )
}
