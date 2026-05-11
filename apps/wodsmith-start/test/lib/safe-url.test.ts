import { describe, expect, it } from "vitest"
import { safeHttpUrl } from "@/lib/safe-url"

describe("safeHttpUrl", () => {
  it("returns null for empty / nullish input", () => {
    expect(safeHttpUrl(null)).toBeNull()
    expect(safeHttpUrl(undefined)).toBeNull()
    expect(safeHttpUrl("")).toBeNull()
  })

  it("returns the URL for https schemes", () => {
    expect(safeHttpUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    )
  })

  it("returns the URL for http schemes", () => {
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/")
  })

  it("returns null for unsafe schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull()
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull()
    expect(safeHttpUrl("vbscript:msgbox(1)")).toBeNull()
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull()
  })

  it("returns null for malformed URLs", () => {
    expect(safeHttpUrl("not a url")).toBeNull()
    expect(safeHttpUrl("//example.com")).toBeNull()
  })
})
