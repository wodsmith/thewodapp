// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import { strFromU8, unzipSync } from "fflate"
import { buildTabularParseResult } from "./tabular"
import type { CsvParseResult, ImportIssue } from "./types"

interface ParseXlsxOptions {
  maxRows?: number
}

interface SheetRow {
  rowNumber: number
  values: string[]
}

type DateStyleKind = "date" | "time" | "dateTime"

export function parseXlsx(
  input: Uint8Array | ArrayBuffer,
  options: ParseXlsxOptions = {},
): CsvParseResult {
  const fileIssues: ImportIssue[] = []
  let files: Record<string, Uint8Array>

  try {
    files = unzipSync(
      input instanceof Uint8Array ? input : new Uint8Array(input),
    )
  } catch {
    return emptyWorkbookError("Excel workbook could not be opened.")
  }

  const workbookXml = readZipText(files, "xl/workbook.xml")
  if (!workbookXml) {
    return emptyWorkbookError("Excel workbook is missing workbook metadata.")
  }

  const worksheetPath = getFirstWorksheetPath(files, workbookXml)
  if (!worksheetPath) {
    return emptyWorkbookError("Excel workbook does not include a worksheet.")
  }

  const worksheetXml = readZipText(files, worksheetPath)
  if (!worksheetXml) {
    return emptyWorkbookError("Excel worksheet could not be read.")
  }

  const sharedStrings = parseSharedStrings(
    readZipText(files, "xl/sharedStrings.xml"),
  )
  const dateStyles = parseDateStyles(readZipText(files, "xl/styles.xml"))
  const sheetRows = parseSheetRows(worksheetXml, sharedStrings, dateStyles)
  const headerIndex = sheetRows.findIndex((row) =>
    row.values.some((value) => value.trim().length > 0),
  )

  if (headerIndex === -1) {
    return buildTabularParseResult({
      headers: [],
      dataRows: [],
      fileIssues,
      maxRows: options.maxRows,
      sourceLabel: "Excel sheet",
    })
  }

  const headers = sheetRows[headerIndex]?.values ?? []
  const dataRows = sheetRows.slice(headerIndex + 1).map((row) => ({
    rowNumber: row.rowNumber,
    values:
      row.values.length < headers.length
        ? [...row.values, ...Array(headers.length - row.values.length).fill("")]
        : row.values,
  }))

  return buildTabularParseResult({
    headers,
    dataRows,
    fileIssues,
    maxRows: options.maxRows,
    sourceLabel: "Excel sheet",
  })
}

function emptyWorkbookError(message: string): CsvParseResult {
  return {
    headers: [],
    rows: [],
    fileIssues: [{ code: "invalid_workbook", severity: "error", message }],
    skippedRowCount: 0,
  }
}

function readZipText(files: Record<string, Uint8Array>, path: string) {
  const file = files[path]
  return file ? strFromU8(file) : null
}

function getFirstWorksheetPath(
  files: Record<string, Uint8Array>,
  workbookXml: string,
) {
  const sheetTag = workbookXml.match(/<sheet\b[^>]*>/)?.[0]
  const relationshipId = sheetTag
    ? getAttribute(sheetTag, "r:id") || getAttribute(sheetTag, "id")
    : null
  const workbookRelsXml = readZipText(files, "xl/_rels/workbook.xml.rels")

  if (relationshipId && workbookRelsXml) {
    const relationship = findRelationship(workbookRelsXml, relationshipId)
    if (relationship?.target) return resolveWorkbookTarget(relationship.target)
  }

  return files["xl/worksheets/sheet1.xml"] ? "xl/worksheets/sheet1.xml" : null
}

function findRelationship(relsXml: string, relationshipId: string) {
  const relationshipPattern = /<Relationship\b[^>]*>/g
  let match = relationshipPattern.exec(relsXml)

  while (match) {
    const tag = match[0] ?? ""
    if (getAttribute(tag, "Id") === relationshipId) {
      return { target: getAttribute(tag, "Target") }
    }
    match = relationshipPattern.exec(relsXml)
  }

  return null
}

function resolveWorkbookTarget(target: string) {
  if (target.startsWith("/")) return target.replace(/^\/+/, "")
  if (target.startsWith("xl/")) return target
  return `xl/${target.replace(/^\/+/, "")}`
}

function parseSharedStrings(xml: string | null) {
  if (!xml) return []

  const strings: string[] = []
  const sharedStringPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g
  let match = sharedStringPattern.exec(xml)

  while (match) {
    strings.push(extractText(match[1] ?? ""))
    match = sharedStringPattern.exec(xml)
  }

  return strings
}

function parseDateStyles(xml: string | null) {
  const styles = new Map<number, DateStyleKind>()
  if (!xml) return styles

  const customFormats = new Map<number, string>()
  const numFmtPattern = /<numFmt\b[^>]*>/g
  let numFmtMatch = numFmtPattern.exec(xml)

  while (numFmtMatch) {
    const tag = numFmtMatch[0] ?? ""
    const id = Number(getAttribute(tag, "numFmtId"))
    const formatCode = getAttribute(tag, "formatCode")
    if (Number.isInteger(id) && formatCode) {
      customFormats.set(id, decodeXml(formatCode))
    }
    numFmtMatch = numFmtPattern.exec(xml)
  }

  const cellXfsMatch = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)
  const cellXfsXml = cellXfsMatch?.[1] ?? ""
  const xfPattern = /<xf\b[^>]*>/g
  let xfMatch = xfPattern.exec(cellXfsXml)
  let styleIndex = 0

  while (xfMatch) {
    const numFmtId = Number(getAttribute(xfMatch[0] ?? "", "numFmtId"))
    const styleKind = getDateStyleKind(numFmtId, customFormats.get(numFmtId))
    if (styleKind) styles.set(styleIndex, styleKind)
    styleIndex++
    xfMatch = xfPattern.exec(cellXfsXml)
  }

  return styles
}

function parseSheetRows(
  worksheetXml: string,
  sharedStrings: string[],
  dateStyles: Map<number, DateStyleKind>,
) {
  const rows: SheetRow[] = []
  const rowPattern = /<row\b([^>]*)>([\s\S]*?)<\/row>/g
  let rowMatch = rowPattern.exec(worksheetXml)

  while (rowMatch) {
    const rowAttributes = rowMatch[1] ?? ""
    const rowNumber =
      Number(getAttribute(rowAttributes, "r")) || rows.length + 1
    const cells: Array<{ columnIndex: number; value: string }> = []
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/g
    let cellMatch = cellPattern.exec(rowMatch[2] ?? "")

    while (cellMatch) {
      const attributes = cellMatch[1] ?? ""
      const cellRef = getAttribute(attributes, "r")
      const columnIndex = cellRef
        ? columnIndexFromCellRef(cellRef)
        : cells.length
      cells.push({
        columnIndex,
        value: parseCellValue(
          attributes,
          cellMatch[2] ?? "",
          sharedStrings,
          dateStyles,
        ),
      })
      cellMatch = cellPattern.exec(rowMatch[2] ?? "")
    }

    const values: string[] = []
    for (const cell of cells) {
      values[cell.columnIndex] = cell.value
    }

    rows.push({
      rowNumber,
      values: trimTrailingEmptyValues(values.map((value) => value ?? "")),
    })
    rowMatch = rowPattern.exec(worksheetXml)
  }

  return rows
}

function parseCellValue(
  attributes: string,
  cellXml: string,
  sharedStrings: string[],
  dateStyles: Map<number, DateStyleKind>,
) {
  const type = getAttribute(attributes, "t")
  const rawValue = extractFirstTagValue(cellXml, "v")

  if (type === "s") {
    const index = Number(rawValue)
    return Number.isInteger(index) ? (sharedStrings[index] ?? "") : ""
  }

  if (type === "inlineStr")
    return extractText(extractFirstTagValue(cellXml, "is"))
  if (type === "b") return rawValue === "1" ? "true" : "false"
  if (type === "e") return ""
  if (type === "str" || type === "d") return decodeXml(rawValue)

  const styleIndex = Number(getAttribute(attributes, "s"))
  const dateStyleKind = Number.isInteger(styleIndex)
    ? dateStyles.get(styleIndex)
    : undefined

  if (dateStyleKind) {
    const formatted = formatExcelDateNumber(rawValue, dateStyleKind)
    if (formatted) return formatted
  }

  return formatPlainCellValue(rawValue)
}

function getDateStyleKind(
  numFmtId: number,
  customFormatCode?: string,
): DateStyleKind | null {
  if ([14, 15, 16, 17].includes(numFmtId)) return "date"
  if ([18, 19, 20, 21, 45, 46, 47].includes(numFmtId)) return "time"
  if (numFmtId === 22) return "dateTime"

  if (!customFormatCode) return null

  const code = customFormatCode
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[[^\]]*]/g, "")
    .toLowerCase()
  const hasDate = /[dy]/.test(code)
  const hasTime = /h|s|am\/pm|a\/p/.test(code)

  if (hasDate && hasTime) return "dateTime"
  if (hasTime) return "time"
  if (hasDate) return "date"
  return null
}

function formatExcelDateNumber(value: string, styleKind: DateStyleKind) {
  const serial = Number(value)
  if (!Number.isFinite(serial)) return null

  const totalSeconds = Math.round(serial * 86_400)
  const wholeDays = Math.floor(totalSeconds / 86_400)
  const secondsIntoDay = ((totalSeconds % 86_400) + 86_400) % 86_400
  const date = new Date(Date.UTC(1899, 11, 30 + wholeDays))
  const hours = Math.floor(secondsIntoDay / 3600)
  const minutes = Math.floor((secondsIntoDay % 3600) / 60)

  if (styleKind === "time") return formatClockTime(hours, minutes)

  const datePart = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-")

  if (styleKind === "date") return datePart
  return `${datePart} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function formatClockTime(hours: number, minutes: number) {
  const meridiem = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${meridiem}`
}

function formatPlainCellValue(value: string) {
  const trimmed = decodeXml(value).trim()
  if (!trimmed) return ""

  const numberValue = Number(trimmed)
  return Number.isFinite(numberValue) ? String(numberValue) : trimmed
}

function columnIndexFromCellRef(cellRef: string) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0] ?? ""
  let index = 0

  for (const letter of letters.toUpperCase()) {
    index = index * 26 + (letter.charCodeAt(0) - 64)
  }

  return Math.max(0, index - 1)
}

function trimTrailingEmptyValues(values: string[]) {
  let end = values.length
  while (end > 0 && !values[end - 1]?.trim()) end--
  return values.slice(0, end)
}

function extractFirstTagValue(xml: string, tagName: string) {
  const match = xml.match(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`),
  )
  return match?.[1] ?? ""
}

function extractText(xml: string) {
  const textParts = [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(
    (match) => decodeXml(match[1] ?? ""),
  )
  return textParts.length > 0 ? textParts.join("") : decodeXml(stripTags(xml))
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, "")
}

function getAttribute(tag: string, name: string) {
  const escapedName = name.replace(":", "\\:")
  const pattern = new RegExp(`\\b${escapedName}="([^"]*)"`)
  return decodeXml(tag.match(pattern)?.[1] ?? "")
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}
