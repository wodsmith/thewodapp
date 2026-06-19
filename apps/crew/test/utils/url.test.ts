import { describe, expect, it } from "vitest"
import { isSafeUrl } from "@/utils/url"

describe("isSafeUrl", () => {
	it("returns true for https URLs", () => {
		expect(isSafeUrl("https://example.com")).toBe(true)
		expect(isSafeUrl("https://youtube.com/watch?v=abc")).toBe(true)
		expect(isSafeUrl("https://sub.domain.co.uk/path?q=1")).toBe(true)
	})

	it("returns true for http URLs", () => {
		expect(isSafeUrl("http://example.com")).toBe(true)
		expect(isSafeUrl("http://localhost:3000")).toBe(true)
	})

	it("returns false for javascript: protocol", () => {
		expect(isSafeUrl("javascript:alert(1)")).toBe(false)
	})

	it("returns false for data: protocol", () => {
		expect(isSafeUrl("data:text/html,<h1>hi</h1>")).toBe(false)
	})

	it("returns false for ftp: protocol", () => {
		expect(isSafeUrl("ftp://files.example.com")).toBe(false)
	})

	it("returns false for file: protocol", () => {
		expect(isSafeUrl("file:///etc/passwd")).toBe(false)
	})

	it("returns false for malformed URLs", () => {
		expect(isSafeUrl("not-a-url")).toBe(false)
		expect(isSafeUrl("")).toBe(false)
		expect(isSafeUrl("://missing-scheme")).toBe(false)
	})
})
