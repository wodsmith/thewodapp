import type { ImportIssue, PreviewImportRow, VolunteerImportRow } from "./types"

export function addDuplicateEmailWarnings(rows: PreviewImportRow[]) {
  const rowsByEmail = new Map<string, PreviewImportRow[]>()

  for (const row of rows) {
    const email = (row.normalizedRow as VolunteerImportRow).email
    if (!email) continue

    const existing = rowsByEmail.get(email) ?? []
    existing.push(row)
    rowsByEmail.set(email, existing)
  }

  for (const [email, duplicates] of rowsByEmail) {
    if (duplicates.length < 2) continue

    for (const row of duplicates) {
      row.warnings.push(createDuplicateEmailIssue(row.rowNumber, email))
      if (row.action !== "error") row.action = "skip"
    }
  }
}

function createDuplicateEmailIssue(
  rowNumber: number,
  email: string,
): ImportIssue {
  return {
    code: "duplicate_email",
    severity: "warning",
    rowNumber,
    field: "email",
    value: email,
    message: "Email appears more than once in this file.",
  }
}
