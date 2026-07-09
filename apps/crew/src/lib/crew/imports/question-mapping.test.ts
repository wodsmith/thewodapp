// @lat: [[crew#Import CSV Preview#Question Mapped Columns]]
import { describe, expect, it } from "vitest"
import { sanitizeColumnMapping } from "./column-mapping"
import { adaptImportMappingToHeaders } from "./mapping-memory"
import {
  buildExistingQuestionMappingKey,
  buildNewQuestionMappingKey,
  buildVolunteerAnswerUpserts,
  collectVolunteerQuestionsToCreate,
  parseQuestionMappingKey,
  planVolunteerQuestionColumns,
  resolveVolunteerQuestionColumns,
} from "./question-mapping"
import type { ColumnMapping } from "./types"

describe("question mapping keys", () => {
  it("round-trips existing and new question keys", () => {
    expect(
      parseQuestionMappingKey(buildExistingQuestionMappingKey("crq_1")),
    ).toEqual({ kind: "existing", value: "crq_1" })
    expect(
      parseQuestionMappingKey(buildNewQuestionMappingKey("Shoe Size")),
    ).toEqual({ kind: "new", value: "Shoe Size" })
    expect(parseQuestionMappingKey("email")).toBeNull()
    expect(parseQuestionMappingKey("question:")).toBeNull()
  })
})

describe("sanitizeColumnMapping with question keys", () => {
  const headers = ["Email", "Shoe Size", "Instagram"]

  it("keeps valid question keys for volunteers and drops unknown headers", () => {
    const mapping: ColumnMapping = {
      email: "Email",
      [buildExistingQuestionMappingKey("crq_1")]: "Shoe Size",
      [buildNewQuestionMappingKey("Instagram")]: "Instagram",
      [buildNewQuestionMappingKey("Missing")]: "Not A Header",
    }

    const sanitized = sanitizeColumnMapping(mapping, headers, "volunteers")

    expect(sanitized).toEqual({
      email: "Email",
      [buildExistingQuestionMappingKey("crq_1")]: "Shoe Size",
      [buildNewQuestionMappingKey("Instagram")]: "Instagram",
    })
  })

  it("drops question keys for non-volunteer imports", () => {
    const mapping: ColumnMapping = {
      [buildExistingQuestionMappingKey("crq_1")]: "Shoe Size",
    }

    expect(sanitizeColumnMapping(mapping, headers, "heat_schedule")).toEqual({})
  })

  it("survives a preset adapt round-trip", () => {
    const mapping: ColumnMapping = {
      email: "Email",
      [buildNewQuestionMappingKey("Shoe Size")]: "Shoe Size",
    }

    const adapted = adaptImportMappingToHeaders({
      columnMapping: mapping,
      headers,
      kind: "volunteers",
    })

    expect(adapted).toEqual(mapping)
  })
})

describe("resolveVolunteerQuestionColumns", () => {
  const existing = [{ id: "crq_shoe", label: "Shoe Size" }]

  it("resolves existing ids and collapses new labels onto existing questions", () => {
    const mapping: ColumnMapping = {
      email: "Email",
      [buildExistingQuestionMappingKey("crq_shoe")]: "Shoe",
      // Different label casing should collapse onto the existing question.
      [buildNewQuestionMappingKey("shoe size")]: "Shoe Two",
      [buildNewQuestionMappingKey("Instagram")]: "Instagram",
    }

    const resolved = resolveVolunteerQuestionColumns(mapping, existing)

    expect(resolved).toEqual([
      {
        columnKey: buildExistingQuestionMappingKey("crq_shoe"),
        header: "Shoe",
        questionId: "crq_shoe",
        label: "Shoe Size",
        isNew: false,
      },
      {
        columnKey: buildNewQuestionMappingKey("shoe size"),
        header: "Shoe Two",
        questionId: "crq_shoe",
        label: "Shoe Size",
        isNew: false,
      },
      {
        columnKey: buildNewQuestionMappingKey("Instagram"),
        header: "Instagram",
        questionId: null,
        label: "Instagram",
        isNew: true,
      },
    ])
  })

  it("drops stale existing-question ids", () => {
    const mapping: ColumnMapping = {
      [buildExistingQuestionMappingKey("crq_missing")]: "Instagram",
    }

    expect(resolveVolunteerQuestionColumns(mapping, existing)).toEqual([])
  })
})

describe("planVolunteerQuestionColumns", () => {
  it("plans new questions, counts answers, and warns on empty columns", () => {
    const mapping: ColumnMapping = {
      [buildNewQuestionMappingKey("Shoe Size")]: "Shoe Size",
      [buildNewQuestionMappingKey("Instagram")]: "Instagram",
    }
    const resolved = resolveVolunteerQuestionColumns(mapping, [])
    const rowValues = [
      { "Shoe Size": "10", Instagram: "" },
      { "Shoe Size": "  ", Instagram: "" },
      { "Shoe Size": "9", Instagram: "" },
    ]

    const plan = planVolunteerQuestionColumns(resolved, rowValues)

    expect(plan.questionsToCreate).toEqual(["Shoe Size"])
    expect(plan.totalAnswerCount).toBe(2)
    expect(plan.columns).toEqual([
      expect.objectContaining({
        label: "Shoe Size",
        willCreate: true,
        answerCount: 2,
      }),
      expect.objectContaining({
        label: "Instagram",
        willCreate: false,
        answerCount: 0,
      }),
    ])
    expect(plan.warnings).toEqual([
      expect.objectContaining({
        code: "empty_question_column",
        severity: "warning",
      }),
    ])
  })
})

describe("collectVolunteerQuestionsToCreate", () => {
  it("dedupes by normalized label, skips existing, and orders after max sort", () => {
    const rows = [
      {
        questionAnswers: [
          { questionId: null, label: "Shoe Size", answer: "10" },
          { questionId: "crq_shirt", label: "Shirt", answer: "L" },
        ],
      },
      {
        questionAnswers: [
          { questionId: null, label: "shoe size", answer: "9" },
          { questionId: null, label: "Instagram", answer: "@ian" },
          // Matches an existing question label -> not created again.
          { questionId: null, label: "Gender", answer: "F" },
          // Empty answers never trigger creation.
          { questionId: null, label: "Whatsapp", answer: "  " },
        ],
      },
    ]
    const existingQuestions = [
      { id: "crq_gender", label: "Gender", sortOrder: 4 },
    ]

    const toCreate = collectVolunteerQuestionsToCreate({
      rows,
      existingQuestions,
    })

    expect(toCreate).toEqual([
      { label: "Shoe Size", sortOrder: 5 },
      { label: "Instagram", sortOrder: 6 },
    ])
  })
})

describe("buildVolunteerAnswerUpserts", () => {
  it("resolves new-question ids, skips unmapped rows, and dedupes pairs", () => {
    const rows = [
      {
        rowNumber: 1,
        questionAnswers: [
          { questionId: "crq_shirt", label: "Shirt", answer: "L" },
          { questionId: null, label: "Shoe Size", answer: "10" },
          // Duplicate (question, invitation) pair -> first wins.
          { questionId: null, label: "shoe size", answer: "11" },
        ],
      },
      {
        // No invitation id for this row (e.g. membership update) -> skipped.
        rowNumber: 2,
        questionAnswers: [
          { questionId: "crq_shirt", label: "Shirt", answer: "M" },
        ],
      },
    ]

    const upserts = buildVolunteerAnswerUpserts({
      rows,
      questionIdByNormalizedLabel: new Map([["shoe size", "crq_shoe"]]),
      invitationIdByRowNumber: new Map([[1, "inv_1"]]),
    })

    expect(upserts).toEqual([
      { questionId: "crq_shirt", invitationId: "inv_1", answer: "L" },
      { questionId: "crq_shoe", invitationId: "inv_1", answer: "10" },
    ])
  })
})
