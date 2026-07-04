import { describe, expect, expectTypeOf, it } from "vitest"
import { MESSAGE_TEMPLATE_TYPE } from "@/db/schemas/message-templates"
import {
  type CrewTemplateVariableKey,
  MESSAGE_TEMPLATE_TYPES,
  getCompetitionMessageTemplateVariables,
  getDefaultCompetitionMessageTemplate,
  renderCompetitionMessageTemplate,
} from "@/lib/crew/message-templates"

describe("renderCompetitionMessageTemplate", () => {
  it("substitutes known variables in subject and body", () => {
    const result = renderCompetitionMessageTemplate({
      subject: "{{eventName}}: confirm {{shiftName}}",
      body: "Hi {{volunteerName}}, you are on {{shiftName}}.",
      variables: {
        eventName: "Summer Throwdown",
        shiftName: "Lane judging",
        volunteerName: "Ada",
      },
    })

    expect(result.subject).toBe("Summer Throwdown: confirm Lane judging")
    expect(result.paragraphs).toEqual([
      "Hi Ada, you are on Lane judging.",
    ])
  })

  it("leaves unknown variables literal", () => {
    const result = renderCompetitionMessageTemplate({
      subject: "Hello {{unknownVar}}",
      body: "Body {{alsoUnknown}} text",
      variables: { volunteerName: "Ada" },
    })

    expect(result.subject).toBe("Hello {{unknownVar}}")
    expect(result.paragraphs).toEqual(["Body {{alsoUnknown}} text"])
  })

  it("leaves empty-valued variables literal so blanks don't collapse", () => {
    const result = renderCompetitionMessageTemplate({
      subject: "s",
      body: "Location: {{location}}",
      variables: { location: "" },
    })

    expect(result.paragraphs).toEqual(["Location: {{location}}"])
  })

  it("splits the body into paragraphs on blank lines", () => {
    const result = renderCompetitionMessageTemplate({
      subject: "s",
      body: "First para.\n\nSecond para.\n\n\nThird para.",
      variables: {},
    })

    expect(result.paragraphs).toEqual([
      "First para.",
      "Second para.",
      "Third para.",
    ])
  })

  it("keeps single newlines inside a paragraph", () => {
    const result = renderCompetitionMessageTemplate({
      subject: "s",
      body: "Shift: A\nRole: B\n\nNext",
      variables: {},
    })

    expect(result.paragraphs).toEqual(["Shift: A\nRole: B", "Next"])
  })
})

describe("getDefaultCompetitionMessageTemplate", () => {
  it("returns default copy for every template type", () => {
    for (const type of MESSAGE_TEMPLATE_TYPES) {
      const template = getDefaultCompetitionMessageTemplate(type)
      expect(template.subject.length).toBeGreaterThan(0)
      expect(template.body.length).toBeGreaterThan(0)
    }
  })

  it("matches the assignment confirmation subject wording", () => {
    const template = getDefaultCompetitionMessageTemplate(
      MESSAGE_TEMPLATE_TYPE.ASSIGNMENT_CONFIRMATION,
    )
    expect(template.subject).toBe("{{eventName}}: confirm {{shiftName}}")
    expect(template.body).toContain(
      "You are assigned to help with {{eventName}}",
    )
  })

  it("uses the reminder wording for the 24-hour reminder", () => {
    const template = getDefaultCompetitionMessageTemplate(
      MESSAGE_TEMPLATE_TYPE.REMINDER_24_HOUR,
    )
    expect(template.body).toContain("within 24 hours")
  })

  it("returns a fresh copy that callers cannot mutate", () => {
    const first = getDefaultCompetitionMessageTemplate(
      MESSAGE_TEMPLATE_TYPE.CUSTOM_BROADCAST,
    )
    first.subject = "mutated"
    const second = getDefaultCompetitionMessageTemplate(
      MESSAGE_TEMPLATE_TYPE.CUSTOM_BROADCAST,
    )
    expect(second.subject).not.toBe("mutated")
  })
})

describe("getCompetitionMessageTemplateVariables", () => {
  it("exposes the full variable set for assignment confirmations", () => {
    const keys = getCompetitionMessageTemplateVariables(
      MESSAGE_TEMPLATE_TYPE.ASSIGNMENT_CONFIRMATION,
    ).map((variable) => variable.key)
    expect(keys).toContain("confirmUrl")
    expect(keys).toContain("shiftName")
    expect(keys).toContain("scheduleUrl")
  })

  it("limits custom broadcast to volunteer/event/schedule variables", () => {
    const keys = getCompetitionMessageTemplateVariables(
      MESSAGE_TEMPLATE_TYPE.CUSTOM_BROADCAST,
    ).map((variable) => variable.key)
    expect(keys).toEqual(["volunteerName", "eventName", "scheduleUrl"])
    expect(keys).not.toContain("confirmUrl")
    expect(keys).not.toContain("shiftName")
  })
})

describe("message template variable typing", () => {
  it("types the render variables parameter as the variable-key union", () => {
    type Variables = Parameters<
      typeof renderCompetitionMessageTemplate
    >[0]["variables"]
    expectTypeOf<Variables>().toEqualTypeOf<
      Partial<Record<CrewTemplateVariableKey, string>>
    >()
  })

  it("rejects unknown variable keys at the render call site", () => {
    renderCompetitionMessageTemplate({
      subject: "s",
      body: "b",
      variables: {
        volunteerName: "Ada",
        // @ts-expect-error unknown keys are not part of the variable-key union
        bogusKey: "x",
      },
    })
  })

  it("types variable definition keys as the union, not string", () => {
    expectTypeOf<
      ReturnType<typeof getCompetitionMessageTemplateVariables>[number]["key"]
    >().toEqualTypeOf<CrewTemplateVariableKey>()
  })
})
