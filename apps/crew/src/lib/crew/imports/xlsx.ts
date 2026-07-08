// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import { strFromU8, unzipSync } from "fflate"
import { buildTabularParseResult } from "./tabular"
import type { CsvParseResult, ImportIssue } from "./types"

const MAX_ENTRY_BYTES = 20 * 1024 * 1024
const MAX_TOTAL_BYTES = 50 * 1024 * 1024

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
  let totalBytes = 0
  let exceededSizeCap = false

  try {
    files = unzipSync(
      input instanceof Uint8Array ? input : new Uint8Array(input),
      {
        filter: (file) => {
          if (!isReadableEntry(file.name)) return false
          if (file.originalSize > MAX_ENTRY_BYTES) {
            exceededSizeCap = true
            return false
          }
          totalBytes += file.originalSize
          if (totalBytes > MAX_TOTAL_BYTES) {
            exceededSizeCap = true
            return false
          }
          return true
        },
      },
    )
  } catch {
    return emptyWorkbookError("Excel workbook could not be opened.")
  }

  // ZIP entry headers declare originalSize; verify actual inflated bytes too.
  let actualTotalBytes = 0
  for (const file of Object.values(files)) {
    actualTotalBytes += file.byteLength
    if (
      file.byteLength > MAX_ENTRY_BYTES ||
      actualTotalBytes > MAX_TOTAL_BYTES
    ) {
      exceededSizeCap = true
      break
    }
  }

  if (exceededSizeCap) {
    return emptyWorkbookError("Excel workbook is too large to import.")
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

function isReadableEntry(name: string) {
  return (
    name === "xl/workbook.xml" ||
    name === "xl/_rels/workbook.xml.rels" ||
    name === "xl/sharedStrings.xml" ||
    name === "xl/styles.xml" ||
    name.startsWith("xl/worksheets/")
  )
}

function readZipText(files: Record<string, Uint8Array>, path: string) {
  const file = files[path]
  return file ? strFromU8(file) : null
}

function getFirstWorksheetPath(
  files: Record<string, Uint8Array>,
  workbookXml: string,
) {
  const sheetTags = workbookXml.match(/<sheet\b[^>]*>/g) ?? []
  const firstRelationshipId = sheetTags
    .map((tag) => getAttribute(tag, "r:id") || getAttribute(tag, "id"))
    .find((id) => id.length > 0)
  const workbookRelsXml = readZipText(files, "xl/_rels/workbook.xml.rels")

  if (workbookRelsXml) {
    const relationships = parseRelationships(workbookRelsXml)
    const worksheet = relationships.find(
      (relationship) =>
        relationship.target && relationship.type.endsWith("/worksheet"),
    )
    if (worksheet?.target) return resolveWorkbookTarget(worksheet.target)

    const fallback = relationships.find(
      (relationship) => relationship.id === firstRelationshipId,
    )
    if (fallback?.target) return resolveWorkbookTarget(fallback.target)
  }

  return files["xl/worksheets/sheet1.xml"] ? "xl/worksheets/sheet1.xml" : null
}

function parseRelationships(relsXml: string) {
  const relationships: Array<{ id: string; target: string; type: string }> = []
  const relationshipPattern = /<Relationship\b[^>]*>/g
  let match = relationshipPattern.exec(relsXml)

  while (match) {
    const tag = match[0] ?? ""
    relationships.push({
      id: getAttribute(tag, "Id"),
      target: getAttribute(tag, "Target"),
      type: getAttribute(tag, "Type"),
    })
    match = relationshipPattern.exec(relsXml)
  }

  return relationships
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
      values: trimTrailingEmptyValues(
        Array.from(
          { length: values.length },
          (_, index) => values[index] ?? "",
        ),
      ),
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

  if (dateStyleKind && rawValue !== "") {
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
  const seconds = secondsIntoDay % 60

  if (styleKind === "time") return formatClockTime(hours, minutes, seconds)

  const datePart = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-")

  if (styleKind === "date") return datePart
  const timePart = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  return seconds > 0
    ? `${datePart} ${timePart}:${String(seconds).padStart(2, "0")}`
    : `${datePart} ${timePart}`
}

function formatClockTime(hours: number, minutes: number, seconds: number) {
  const meridiem = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 || 12
  const secondsPart = seconds > 0 ? `:${String(seconds).padStart(2, "0")}` : ""
  return `${displayHour}:${String(minutes).padStart(2, "0")}${secondsPart} ${meridiem}`
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
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "")
  const textParts = [
    ...withoutPhonetic.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g),
  ].map((match) => decodeXml(match[1] ?? ""))
  return textParts.length > 0
    ? textParts.join("")
    : decodeXml(stripTags(withoutPhonetic))
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, "")
}

function getAttribute(tag: string, name: string) {
  const escapedName = name.replace(":", "\\:")
  const pattern = new RegExp(`\\b${escapedName}=(?:"([^"]*)"|'([^']*)')`)
  const match = tag.match(pattern)
  return decodeXml(match?.[1] ?? match?.[2] ?? "")
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (entity, code: string) =>
      decodeCodePoint(entity, Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (entity, code: string) =>
      decodeCodePoint(entity, Number.parseInt(code, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

function decodeCodePoint(entity: string, codePoint: number) {
  // String.fromCodePoint throws past 0x10FFFF; keep malformed entities as text.
  if (
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return entity
  }
  return String.fromCodePoint(codePoint)
}
