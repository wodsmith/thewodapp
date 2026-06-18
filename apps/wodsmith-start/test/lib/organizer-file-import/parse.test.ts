import { describe, expect, it } from "vitest"
import {
  boundTableForModel,
  type ParsedTable,
  parseDelimited,
  parseImportFile,
  renderParsedForModel,
} from "@/lib/organizer-file-import/parse"

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

describe("parseDelimited", () => {
  it("parses CSV into header-keyed rows", () => {
    const table = parseDelimited("name,email\nMorgan,m@x.com\nSam,s@x.com")
    expect(table.headers).toEqual(["name", "email"])
    expect(table.rowCount).toBe(2)
    expect(table.rows[0]).toEqual({ name: "Morgan", email: "m@x.com" })
  })

  it("trims headers and skips empty lines", () => {
    const table = parseDelimited("  name , email \nMorgan,m@x.com\n\n\n")
    expect(table.headers).toEqual(["name", "email"])
    expect(table.rowCount).toBe(1)
  })

  it("parses TSV when given a tab delimiter", () => {
    const table = parseDelimited("name\temail\nMorgan\tm@x.com", "\t")
    expect(table.headers).toEqual(["name", "email"])
    expect(table.rows[0]?.email).toBe("m@x.com")
  })
})

describe("parseImportFile", () => {
  it("parses by csv mime type", () => {
    const parsed = parseImportFile({
      bytes: bytesOf("a,b\n1,2"),
      mimeType: "text/csv",
      filename: "roster.csv",
    })
    expect(parsed.kind).toBe("table")
  })

  it("falls back to extension when mime is generic", () => {
    const parsed = parseImportFile({
      bytes: bytesOf("a,b\n1,2"),
      mimeType: "application/octet-stream",
      filename: "roster.csv",
    })
    expect(parsed.kind).toBe("table")
  })

  it("returns text for plain text / markdown", () => {
    const parsed = parseImportFile({
      bytes: bytesOf("# Event packet\nDeadlift 5x5"),
      mimeType: "text/markdown",
      filename: "packet.md",
    })
    expect(parsed.kind).toBe("text")
    if (parsed.kind === "text") {
      expect(parsed.text).toContain("Deadlift")
    }
  })

  it("throws on unsupported types", () => {
    expect(() =>
      parseImportFile({
        bytes: bytesOf("x"),
        mimeType: "application/pdf",
        filename: "packet.pdf",
      }),
    ).toThrow(/Unsupported/)
  })
})

describe("boundTableForModel", () => {
  it("caps rows and adds a warning", () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({ n: String(i) }))
    const table: ParsedTable = {
      kind: "table",
      headers: ["n"],
      rows,
      rowCount: 250,
      warnings: [],
    }
    const bounded = boundTableForModel(table, 200)
    expect(bounded.rows).toHaveLength(200)
    expect(bounded.warnings.join(" ")).toMatch(/first 200 of 250/)
  })

  it("leaves small tables untouched", () => {
    const table: ParsedTable = {
      kind: "table",
      headers: ["n"],
      rows: [{ n: "1" }],
      rowCount: 1,
      warnings: [],
    }
    expect(boundTableForModel(table).rows).toHaveLength(1)
  })
})

describe("renderParsedForModel", () => {
  it("renders columns and rows compactly", () => {
    const table = parseDelimited("name,email\nMorgan,m@x.com")
    const rendered = renderParsedForModel(table)
    expect(rendered).toContain("Columns: name | email")
    expect(rendered).toContain("Morgan")
  })
})
