import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { registerTeamSwitchGuard } from "@/lib/team-switch-guard"
const mock = vi.hoisted(() => ({ setTeam: vi.fn(), invalidate: vi.fn() }))
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: mock.invalidate }),
  Link: ({ children }: { children: ReactNode }) => <a href="/settings/teams/create">{children}</a>,
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mock.setTeam }))
vi.mock("@/server-fns/team-settings-fns", () => ({ setActiveTeamFn: vi.fn() }))
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => null,
  DropdownMenuItem: ({ children, onClick, disabled, asChild }: { children: ReactNode; onClick?: () => void; disabled?: boolean; asChild?: boolean }) => asChild ? <div>{children}</div> : <button type="button" onClick={onClick} disabled={disabled}>{children}</button>,
}))
import { NavTeamSwitcher } from "@/components/nav/nav-team-switcher"
afterEach(cleanup)

// @lat: [[training#Active Team Programming Tests#Navbar waits before changing its cookie]]
it("does not change the active team until editors approve", async () => {
  let resolve!: (allow: boolean) => void
  const unregister = registerTeamSwitchGuard(() => new Promise<boolean>((done) => { resolve = done }))
  mock.setTeam.mockResolvedValue({ success: true })
  try {
    render(<NavTeamSwitcher activeTeamId="one" teams={[{ id: "one", name: "First" }, { id: "two", name: "Second" }]} />)
    fireEvent.click(screen.getByRole("button", { name: "Second" }))
    await waitFor(() => expect(resolve).toBeTypeOf("function"))
    expect(mock.setTeam).not.toHaveBeenCalled()
    await act(async () => resolve(false))
    expect(mock.setTeam).not.toHaveBeenCalled()
    expect(mock.invalidate).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Second" })))
    expect(mock.setTeam).not.toHaveBeenCalled()
    await act(async () => resolve(true))
    expect(mock.setTeam).toHaveBeenCalledWith({ data: { teamId: "two" } })
    expect(mock.invalidate).toHaveBeenCalledTimes(1)
  } finally {
    unregister()
  }
})
