import { Link } from "@tanstack/react-router"
import { LogIn, Menu, UserPlus } from "lucide-react"
import { useState } from "react"
import LogoutButton from "@/components/nav/logout-button"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { CrewAuthState } from "@/server-fns/crew-auth-fns"

// @lat: [[crew#Mobile Layout and Navigation]]
export function CrewHeader({
  session,
  isAdmin,
}: Pick<CrewAuthState, "session" | "isAdmin">) {
  const [open, setOpen] = useState(false)
  const links = [
    { to: "/calculator", label: "Calculator" },
    { to: "/events", label: "Events" },
    { to: "/events/new", label: "New event" },
  ] as const

  const navigation = (mobile = false) => (
    <nav
      aria-label="Main navigation"
      className={
        mobile ? "flex flex-col gap-2" : "flex items-center gap-1 text-sm"
      }
    >
      {links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: true }}
          activeProps={{ className: "bg-muted text-foreground" }}
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center rounded-lg px-3 py-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {label}
        </Link>
      ))}
    </nav>
  )

  const account = (mobile = false) => (
    <div
      className={
        mobile
          ? "flex flex-col gap-3 border-t pt-5"
          : "flex items-center gap-2 text-sm"
      }
    >
      {session ? (
        <>
          <span
            className={
              mobile
                ? "break-all text-sm text-muted-foreground"
                : "hidden max-w-36 truncate text-muted-foreground xl:block"
            }
          >
            {session.user.email}
          </span>
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/crew" onClick={() => setOpen(false)}>
                Admin
              </Link>
            </Button>
          )}
          <LogoutButton />
        </>
      ) : (
        <>
          <Button asChild variant={mobile ? "outline" : "ghost"} size="sm">
            <Link to="/sign-in" onClick={() => setOpen(false)}>
              <LogIn />
              Sign in
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/sign-up" onClick={() => setOpen(false)}>
              <UserPlus />
              Sign up
            </Link>
          </Button>
        </>
      )}
    </div>
  )

  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Link
          to="/"
          className="flex min-h-11 shrink-0 items-center gap-3 font-semibold"
          aria-label="WODsmith Crew home"
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            C
          </span>
          <span>WODsmith Crew</span>
        </Link>
        <div className="hidden items-center gap-6 lg:flex">
          {navigation()}
          {account()}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 lg:hidden [&_svg]:size-5"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="flex w-[min(22rem,calc(100%-1rem))] flex-col gap-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="pr-10">
              <SheetTitle>WODsmith Crew</SheetTitle>
              <SheetDescription className="mt-1">
                Plan your volunteer schedule.
              </SheetDescription>
            </div>
            {navigation(true)}
            {account(true)}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
