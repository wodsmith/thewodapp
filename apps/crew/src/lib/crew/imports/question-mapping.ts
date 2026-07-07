// @lat: [[crew#Import CSV Preview#Question Mapped Columns]]
import type {
  ColumnMapping,
  ImportIssue,
  VolunteerQuestionAnswer,
} from "./types"

// Reserved mapping-key namespaces let a CSV column target a volunteer
// registration question instead of a first-class field, while keeping
// ColumnMapping a plain Record<fieldKey, header> that round-trips through
// preview records and mapping presets. The value stays the CSV header.
export const QUESTION_MAPPING_PREFIX = "question:"
export const NEW_QUESTION_MAPPING_PREFIX = "newQuestion:"

export interface ParsedQuestionMappingKey {
  kind: "existing" | "new"
  // Question id for existing questions, label for to-be-created questions.
  value: string
}

export interface ExistingVolunteerQuestion {
  id: string
  label: string
}

export interface ResolvedQuestionColumn {
  columnKey: string
  header: string
  // Existing question id, or null when the column will create a new question.
  questionId: string | null
  label: string
  isNew: boolean
}

export interface VolunteerQuestionColumnPlan {
  columnKey: string
  header: string
  label: string
  willCreate: boolean
  answerCount: number
}

export interface VolunteerQuestionPreviewPlan {
  columns: VolunteerQuestionColumnPlan[]
  questionsToCreate: string[]
  totalAnswerCount: number
  warnings: ImportIssue[]
}

export interface VolunteerQuestionToCreate {
  label: string
  sortOrder: number
}

export interface VolunteerAnswerUpsert {
  questionId: string
  invitationId: string
  answer: string
}

export function isQuestionMappingKey(key: string) {
  return (
    key.startsWith(QUESTION_MAPPING_PREFIX) ||
    key.startsWith(NEW_QUESTION_MAPPING_PREFIX)
  )
}

export function buildExistingQuestionMappingKey(questionId: string) {
  return `${QUESTION_MAPPING_PREFIX}${questionId}`
}

export function buildNewQuestionMappingKey(label: string) {
  return `${NEW_QUESTION_MAPPING_PREFIX}${label}`
}

export function parseQuestionMappingKey(
  key: string,
): ParsedQuestionMappingKey | null {
  if (key.startsWith(QUESTION_MAPPING_PREFIX)) {
    const value = key.slice(QUESTION_MAPPING_PREFIX.length).trim()
    return value ? { kind: "existing", value } : null
  }
  if (key.startsWith(NEW_QUESTION_MAPPING_PREFIX)) {
    const value = key.slice(NEW_QUESTION_MAPPING_PREFIX.length).trim()
    return value ? { kind: "new", value } : null
  }
  return null
}

export function normalizeQuestionLabel(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ")
}

// Turn question-namespaced mapping keys into resolved columns. New-question
// labels that already match an existing volunteer question (by normalized
// label) collapse onto that question so re-imports never duplicate it. Stale
// existing-question ids that no longer exist for the event are dropped.
export function resolveVolunteerQuestionColumns(
  mapping: ColumnMapping,
  existingQuestions: ExistingVolunteerQuestion[],
): ResolvedQuestionColumn[] {
  const existingById = new Map(
    existingQuestions.map((question) => [question.id, question]),
  )
  const existingByLabel = new Map(
    existingQuestions.map((question) => [
      normalizeQuestionLabel(question.label),
      question,
    ]),
  )
  const resolved: ResolvedQuestionColumn[] = []

  for (const [key, header] of Object.entries(mapping)) {
    if (!header) continue
    const parsed = parseQuestionMappingKey(key)
    if (!parsed) continue

    if (parsed.kind === "existing") {
      const question = existingById.get(parsed.value)
      if (!question) continue
      resolved.push({
        columnKey: key,
        header,
        questionId: question.id,
        label: question.label,
        isNew: false,
      })
      continue
    }

    const match = existingByLabel.get(normalizeQuestionLabel(parsed.value))
    if (match) {
      resolved.push({
        columnKey: key,
        header,
        questionId: match.id,
        label: match.label,
        isNew: false,
      })
      continue
    }

    resolved.push({
      columnKey: key,
      header,
      questionId: null,
      label: parsed.value,
      isNew: true,
    })
  }

  return resolved
}

// Per-row answers for the resolved question columns. Empty values are dropped
// so blank cells never become stored answers.
export function extractRowQuestionAnswers(
  values: Record<string, string>,
  resolved: ResolvedQuestionColumn[],
): VolunteerQuestionAnswer[] {
  const answers: VolunteerQuestionAnswer[] = []
  for (const column of resolved) {
    const answer = (values[column.header] ?? "").trim()
    if (!answer) continue
    answers.push({
      questionId: column.questionId,
      label: column.label,
      answer,
    })
  }
  return answers
}

// Preview planning: which new questions will be created, how many non-empty
// answers each column carries, and a file-level warning for columns that are
// mapped but empty. A new-question column with no values is not planned for
// creation, matching apply behaviour.
export function planVolunteerQuestionColumns(
  resolved: ResolvedQuestionColumn[],
  rowValues: Array<Record<string, string>>,
): VolunteerQuestionPreviewPlan {
  const columns: VolunteerQuestionColumnPlan[] = []
  const warnings: ImportIssue[] = []
  const seenCreateLabels = new Set<string>()
  const questionsToCreate: string[] = []
  let totalAnswerCount = 0

  for (const column of resolved) {
    const answerCount = rowValues.reduce(
      (count, values) =>
        (values[column.header] ?? "").trim() ? count + 1 : count,
      0,
    )
    totalAnswerCount += answerCount

    let willCreate = false
    if (column.isNew && answerCount > 0) {
      const normalizedLabel = normalizeQuestionLabel(column.label)
      if (!seenCreateLabels.has(normalizedLabel)) {
        seenCreateLabels.add(normalizedLabel)
        questionsToCreate.push(column.label)
        willCreate = true
      }
    }

    columns.push({
      columnKey: column.columnKey,
      header: column.header,
      label: column.label,
      willCreate,
      answerCount,
    })

    if (answerCount === 0) {
      warnings.push({
        code: "empty_question_column",
        severity: "warning",
        field: column.columnKey,
        message: `Column "${column.header}" is mapped to question "${column.label}" but has no values, so no answers will be recorded.`,
      })
    }
  }

  return { columns, questionsToCreate, totalAnswerCount, warnings }
}

// Apply planning: dedupe the new questions to create by normalized label,
// skipping any that already exist for the event, and assign sort orders after
// the current max. Only questions with at least one non-empty answer are
// created.
export function collectVolunteerQuestionsToCreate({
  rows,
  existingQuestions,
}: {
  rows: Array<{ questionAnswers: VolunteerQuestionAnswer[] }>
  existingQuestions: Array<{ id: string; label: string; sortOrder: number }>
}): VolunteerQuestionToCreate[] {
  const existingLabels = new Set(
    existingQuestions.map((question) => normalizeQuestionLabel(question.label)),
  )
  const maxSortOrder = existingQuestions.reduce(
    (max, question) => Math.max(max, question.sortOrder),
    0,
  )
  const seen = new Set<string>()
  const toCreate: VolunteerQuestionToCreate[] = []
  let nextSortOrder = maxSortOrder + 1

  for (const row of rows) {
    for (const answer of row.questionAnswers) {
      if (answer.questionId) continue
      if (!answer.answer.trim()) continue
      const normalizedLabel = normalizeQuestionLabel(answer.label)
      if (
        !normalizedLabel ||
        existingLabels.has(normalizedLabel) ||
        seen.has(normalizedLabel)
      ) {
        continue
      }
      seen.add(normalizedLabel)
      toCreate.push({ label: answer.label, sortOrder: nextSortOrder })
      nextSortOrder += 1
    }
  }

  return toCreate
}

// Resolve every non-empty answer to a (questionId, invitationId, answer) upsert.
// New-question answers resolve their created id via normalized label. Rows
// without a mapped invitation (e.g. membership updates) and duplicate
// (questionId, invitationId) pairs within the run are skipped so the unique
// index upsert stays deterministic.
export function buildVolunteerAnswerUpserts({
  rows,
  questionIdByNormalizedLabel,
  invitationIdByRowNumber,
}: {
  rows: Array<{ rowNumber: number; questionAnswers: VolunteerQuestionAnswer[] }>
  questionIdByNormalizedLabel: Map<string, string>
  invitationIdByRowNumber: Map<number, string>
}): VolunteerAnswerUpsert[] {
  const upserts: VolunteerAnswerUpsert[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const invitationId = invitationIdByRowNumber.get(row.rowNumber)
    if (!invitationId) continue

    for (const answer of row.questionAnswers) {
      const value = answer.answer.trim()
      if (!value) continue
      const questionId =
        answer.questionId ??
        questionIdByNormalizedLabel.get(normalizeQuestionLabel(answer.label))
      if (!questionId) continue

      const key = `${questionId}:${invitationId}`
      if (seen.has(key)) continue
      seen.add(key)
      upserts.push({ questionId, invitationId, answer: value })
    }
  }

  return upserts
}
