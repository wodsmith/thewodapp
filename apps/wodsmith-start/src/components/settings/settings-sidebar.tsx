"use client"

import { Link, useLocation } from "@tanstack/react-router"
import {
  Calendar,
  CreditCard,
  LayoutDashboard,
  Lock,
  LogOut,
  Medal,
  Palette,
  Smartphone,
  User,
  Users,
} from "lucide-react"
import { useRef } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/utils/cn"

interface SidebarNavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface SidebarNavGroup {
  label: string
  items: SidebarNavItem[]
}

const navGroups: SidebarNavGroup[] = [
  {
    label: "General",
    items: [
      { title: "Overview", href: "/settings/overview", icon: LayoutDashboard },
      { title: "Profile", href: "/settings/profile", icon: User },
      { title: "Appearance", href: "/settings/appearance", icon: Palette },
    ],
  },
  {
    label: "Athlete",
    items: [
      { title: "Athlete profile", href: "/settings/athlete", icon: Medal },
      { title: "Teams", href: "/settings/teams", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Security", href: "/settings/security", icon: Lock },
      { title: "Sessions", href: "/settings/sessions", icon: Smartphone },
      { title: "Billing", href: "/settings/billing", icon: CreditCard },
    ],
  },
]

const programmingItem: SidebarNavItem = {
  title: "Programming",
  href: "/settings/programming",
  icon: Calendar,
}

interface SettingsSidebarProps {
  hasWorkoutTracking?: boolean
}

export function SettingsSidebar({ hasWorkoutTracking }: SettingsSidebarProps) {
  const location = useLocation()
  const pathname = location.pathname
  const dialogCloseRef = useRef<HTMLButtonElement>(null)

  const groups = hasWorkoutTracking
    ? navGroups.map((g) =>
        g.label === "Athlete"
          ? { ...g, items: [...g.items, programmingItem] }
          : g,
      )
    : navGroups

  const handleSignOut = async () => {
    window.location.href = "/api/auth/sign-out"
  }

  return (
    <div className="w-full lg:w-auto whitespace-nowrap pb-2 overflow-x-auto">
      <nav className="flex items-stretch min-w-full gap-2 pb-2 lg:pb-0 lg:flex-col lg:gap-0 lg:space-y-4">
        {groups.map((group) => (
          <div
            key={group.label}
            className="flex items-center lg:flex-col lg:items-stretch gap-1 lg:gap-0 lg:space-y-1"
          >
            <div className="px-2 lg:px-3 pb-0 lg:pb-1.5 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground shrink-0">
              {group.label}
            </div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  pathname.startsWith(item.href)
                    ? "bg-muted hover:bg-muted dark:text-foreground dark:hover:text-foreground/70"
                    : "hover:bg-transparent",
                  "justify-start hover:no-underline whitespace-nowrap",
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </div>
        ))}

        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "destructive" }),
                "justify-start hover:no-underline whitespace-nowrap lg:mt-4 bg-red-700/25 hover:bg-red-600/40",
              )}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign out?</DialogTitle>
              <DialogDescription>
                Are you sure you want to sign out of your account?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex flex-col gap-4">
              <DialogClose ref={dialogCloseRef} asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  handleSignOut()
                  dialogCloseRef.current?.click()
                }}
              >
                Sign out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </nav>
    </div>
  )
}
