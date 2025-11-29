/**
 * @vitest-environment jsdom
 */
import { useActiveNavItem } from "@/hooks/useActiveNavItem"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

describe("useActiveNavItem", () => {
	const mockNavItems = [
		{ href: "/admin/teams/123", title: "Team Scheduling" },
		{ href: "/admin/teams/123/programming/", title: "Programming" },
	]

	it("should return active state for exact path match", () => {
		const { result } = renderHook(() =>
			useActiveNavItem("/admin/teams/123", mockNavItems),
		)
		const isActiveNavItem = result.current

		expect(isActiveNavItem(mockNavItems[0])).toBe(true)
		expect(isActiveNavItem(mockNavItems[1])).toBe(false)
	})

	it("should return active state for path with trailing content", () => {
		const { result } = renderHook(() =>
			useActiveNavItem("/admin/teams/123/some-page", mockNavItems),
		)
		const isActiveNavItem = result.current

		expect(isActiveNavItem(mockNavItems[0])).toBe(true)
		expect(isActiveNavItem(mockNavItems[1])).toBe(false)
	})

	it("should prioritize more specific routes", () => {
		const { result } = renderHook(() =>
			useActiveNavItem("/admin/teams/123/programming/tracks", mockNavItems),
		)
		const isActiveNavItem = result.current

		expect(isActiveNavItem(mockNavItems[0])).toBe(false)
		expect(isActiveNavItem(mockNavItems[1])).toBe(true)
	})

	it("should handle trailing slashes correctly", () => {
		const { result } = renderHook(() =>
			useActiveNavItem("/admin/teams/123/programming/", mockNavItems),
		)
		const isActiveNavItem = result.current

		expect(isActiveNavItem(mockNavItems[0])).toBe(false)
		expect(isActiveNavItem(mockNavItems[1])).toBe(true)
	})

	it("should return false for unmatched paths", () => {
		const { result } = renderHook(() =>
			useActiveNavItem("/admin/other-page", mockNavItems),
		)
		const isActiveNavItem = result.current

		expect(isActiveNavItem(mockNavItems[0])).toBe(false)
		expect(isActiveNavItem(mockNavItems[1])).toBe(false)
	})
})
