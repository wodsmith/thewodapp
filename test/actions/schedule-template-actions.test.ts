import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createScheduleTemplate, updateScheduleTemplate, deleteScheduleTemplate, getScheduleTemplatesByTeam, getScheduleTemplateById, createScheduleTemplateClass, updateScheduleTemplateClass, deleteScheduleTemplateClass } from '@/actions/schedule-template-actions'
import { getDd } from '@/db'
import { scheduleTemplatesTable, scheduleTemplateClassesTable, scheduleTemplateClassRequiredSkillsTable } from '@/db/schemas/scheduling'
import { eq } from 'drizzle-orm'

// Mock the db and auth modules
const mockDb = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{}])
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [{}])
        }))
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => [{}])
      }))
    })),
    query: {
      scheduleTemplatesTable: {
        findMany: vi.fn(() => ([{}])),
        findFirst: vi.fn(() => ({})),
      },
    }
  }

vi.mock('@/db', () => ({
  getDd: vi.fn(() => mockDb)
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => ({ user: { id: 'test-user-id' } }))
}))

describe('Schedule Template Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Schedule Templates
  it('should create a schedule template', async () => {
    const result = await createScheduleTemplate({ teamId: 'team1', name: 'Template 1', classCatalogId: 'class1', locationId: 'loc1' })
    expect(result).toBeDefined()
    expect(mockDb?.insert).toHaveBeenCalledWith(scheduleTemplatesTable)
  })

  it('should update a schedule template', async () => {
    const result = await updateScheduleTemplate({ id: 'template1', teamId: 'team1', name: 'Updated Template' })
    expect(result).toBeDefined()
    expect(mockDb?.update).toHaveBeenCalledWith(scheduleTemplatesTable)
  })

  it('should delete a schedule template', async () => {
    const result = await deleteScheduleTemplate({ id: 'template1', teamId: 'team1' })
    expect(result).toBeDefined()
    expect(mockDb?.delete).toHaveBeenCalledWith(scheduleTemplatesTable)
  })

  it('should get schedule templates by team', async () => {
    const result = await getScheduleTemplatesByTeam({ teamId: 'team1' })
    expect(result).toBeDefined()
    expect(mockDb?.query.scheduleTemplatesTable.findMany).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should get schedule template by id', async () => {
    const result = await getScheduleTemplateById({ id: 'template1', teamId: 'team1' })
    expect(result).toBeDefined()
    expect(mockDb?.query.scheduleTemplatesTable.findFirst).toHaveBeenCalledWith(expect.any(Object))
  })

  // Schedule Template Classes
  it('should create a schedule template class', async () => {
    const result = await createScheduleTemplateClass({ templateId: 'template1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', requiredCoaches: 1, requiredSkillIds: ['skill1'] })
    expect(result).toBeDefined()
    expect(mockDb?.insert).toHaveBeenCalledWith(scheduleTemplateClassesTable)
    expect(mockDb?.insert).toHaveBeenCalledWith(scheduleTemplateClassRequiredSkillsTable)
  })

  it('should update a schedule template class', async () => {
    const result = await updateScheduleTemplateClass({ id: 'class1', templateId: 'template1', requiredCoaches: 2, requiredSkillIds: ['skill2'] })
    expect(result).toBeDefined()
    expect(mockDb?.update).toHaveBeenCalledWith(scheduleTemplateClassesTable)
    expect(mockDb?.delete).toHaveBeenCalledWith(scheduleTemplateClassRequiredSkillsTable)
    expect(mockDb?.insert).toHaveBeenCalledWith(scheduleTemplateClassRequiredSkillsTable)
  })

  it('should delete a schedule template class', async () => {
    const result = await deleteScheduleTemplateClass({ id: 'class1', templateId: 'template1' })
    expect(result).toBeDefined()
    expect(mockDb?.delete).toHaveBeenCalledWith(scheduleTemplateClassesTable)
  })
})
