import { getTableConfig } from "drizzle-orm/mysql-core"
import { describe, expect, it } from "vitest"
import { createMessageTemplateId } from "@/db/schemas/common"
import { competitionMessageTemplatesTable } from "@/db/schemas/message-templates"

describe("competitionMessageTemplatesTable schema", () => {
  const config = getTableConfig(competitionMessageTemplatesTable)

  it("maps to the competition_message_templates physical table", () => {
    expect(config.name).toBe("competition_message_templates")
  })

  it("has a unique index covering exactly (competitionId, templateType)", () => {
    const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique)
    expect(uniqueIndexes).toHaveLength(1)

    const columnNames = uniqueIndexes[0].config.columns.map(
      (column) => (column as { name: string }).name,
    )
    expect(columnNames).toEqual([
      competitionMessageTemplatesTable.competitionId.name,
      competitionMessageTemplatesTable.templateType.name,
    ])
  })

  it("defaults ids to the msgtpl_ prefix", () => {
    const idColumn = config.columns.find(
      (column) => column.name === competitionMessageTemplatesTable.id.name,
    )
    expect(idColumn).toBeDefined()

    const generated = idColumn?.defaultFn?.()
    expect(typeof generated).toBe("string")
    expect(generated as string).toMatch(/^msgtpl_/)

    expect(createMessageTemplateId()).toMatch(/^msgtpl_/)
  })
})
