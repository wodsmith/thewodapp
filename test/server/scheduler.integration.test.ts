import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSchedule } from '@/server/ai/scheduler'
import { db } from '@/db'



vi.mock('@/db/schemas/scheduling', async () => {
  const actual = await vi.importActual('@/db/schemas/scheduling')
  return {
    ...actual,
    generatedSchedulesTable: actual.generatedSchedulesTable,
    scheduledClassesTable: actual.scheduledClassesTable,
    coachesTable: actual.coachesTable,
    locationsTable: actual.locationsTable,
    classCatalogTable: actual.classCatalogTable,
    skillsTable: actual.skillsTable,
    coachToSkillsTable: actual.coachToSkillsTable,
    coachBlackoutDatesTable: actual.coachBlackoutDatesTable,
    coachRecurringUnavailabilityTable: actual.coachRecurringUnavailabilityTable,
    scheduleTemplatesTable: actual.scheduleTemplatesTable,
    scheduleTemplateClassesTable: actual.scheduleTemplateClassesTable,
    scheduleTemplateClassRequiredSkillsTable: actual.scheduleTemplateClassRequiredSkillsTable,
  }
})

import { sql } from 'drizzle-orm'

vi.mock('@/db/schemas/scheduling', async () => {
  const actual = await vi.importActual('@/db/schemas/scheduling')
  return {
    ...actual,
    generatedSchedulesTable: actual.generatedSchedulesTable,
    scheduledClassesTable: actual.scheduledClassesTable,
    coachesTable: actual.coachesTable,
    locationsTable: actual.locationsTable,
    classCatalogTable: actual.classCatalogTable,
    skillsTable: actual.skillsTable,
    coachToSkillsTable: actual.coachToSkillsTable,
    coachBlackoutDatesTable: actual.coachBlackoutDatesTable,
    coachRecurringUnavailabilityTable: actual.coachRecurringUnavailabilityTable,
    scheduleTemplatesTable: actual.scheduleTemplatesTable,
    scheduleTemplateClassesTable: actual.scheduleTemplateClassesTable,
    scheduleTemplateClassRequiredSkillsTable: actual.scheduleTemplateClassRequiredSkillsTable,
  }
})

// Mock the db
vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn((data) => [data]) // Mock returning the inserted data
      }))
    })),
    query: {
      scheduleTemplatesTable: {
        findFirst: vi.fn(() => ({})),
      },
      coachesTable: {
        findMany: vi.fn(() => ([{}])),
      },
      skillsTable: {
        findMany: vi.fn(() => ([{}])),
      },
    },
  },
}))

describe('AI Scheduling Engine Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations for each test
    db.insert.mockImplementation(() => ({
      values: vi.fn(() => ({
        returning: vi.fn((data) => [data]) // Mock returning the inserted data
      }))
    }))
    db.query.scheduleTemplatesTable.findFirst.mockResolvedValue({
      id: 'template1',
      teamId: 'team1',
      name: 'Test Template',
      templateClasses: [
        {
          id: 'tc1',
          templateId: 'template1',
          classCatalogId: 'class1',
          locationId: 'loc1',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '10:00',
          requiredCoaches: 1,
          requiredSkills: [{ skillId: 'skill1', skill: { id: 'skill1', name: 'CF-L1' } }],
          classCatalog: { id: 'class1', name: 'CrossFit' },
          location: { id: 'loc1', name: 'Main Floor' },
        },
        {
          id: 'tc2',
          templateId: 'template1',
          classCatalogId: 'class2',
          locationId: 'loc2',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '10:00',
          requiredCoaches: 1,
          requiredSkills: [{ skillId: 'skill2', skill: { id: 'skill2', name: 'Yoga Cert' } }],
          classCatalog: { id: 'class2', name: 'Yoga' },
          location: { id: 'loc2', name: 'Studio 2' },
        },
      ],
    })
    db.query.coachesTable.findMany.mockResolvedValue([
      {
        id: 'coach1',
        userId: 'user1',
        teamId: 'team1',
        weeklyClassLimit: 5,
        schedulingPreference: 'morning',
        schedulingNotes: 'early bird',
        isActive: true,
        user: { id: 'user1', firstName: 'John', lastName: 'Doe' },
        skills: [{ skillId: 'skill1', skill: { id: 'skill1', name: 'CF-L1' } }],
        blackoutDates: [],
        recurringUnavailability: [],
      },
      {
        id: 'coach2',
        userId: 'user2',
        teamId: 'team1',
        weeklyClassLimit: 5,
        schedulingPreference: 'afternoon',
        schedulingNotes: 'night owl',
        isActive: true,
        user: { id: 'user2', firstName: 'Jane', lastName: 'Smith' },
        skills: [{ skillId: 'skill2', skill: { id: 'skill2', name: 'Yoga Cert' } }],
        blackoutDates: [],
        recurringUnavailability: [],
      },
    ])
    db.query.skillsTable.findMany.mockResolvedValue([
      { id: 'skill1', name: 'CF-L1' },
      { id: 'skill2', name: 'Yoga Cert' },
    ])
  })

  it('should generate a schedule with assigned coaches for eligible slots', async () => {
    const weekStartDate = new Date('2025-07-07T00:00:00.000Z') // Monday
    const result = await generateSchedule({
      templateId: 'template1',
      weekStartDate,
      teamId: 'team1',
    })

    expect(result).toBeDefined()
    expect(result.newGeneratedSchedule).toBeDefined()
    expect(result.unstaffedClasses).toBe(0) // Expect all classes to be staffed

    // Verify scheduled classes were inserted
    expect(db.insert).toHaveBeenCalledWith(generatedSchedulesTable)
    expect(db.insert).toHaveBeenCalledWith(scheduledClassesTable)

    // Further assertions could check the content of the inserted scheduled classes
    // For example, check if coach1 is assigned to tc1 and coach2 to tc2
  })

  it('should leave classes unstaffed if no eligible coach is found', async () => {
    // Mock coaches to be unavailable for all classes
    db.query.coachesTable.findMany.mockResolvedValue([
      {
        id: 'coach3',
        userId: 'user3',
        teamId: 'team1',
        weeklyClassLimit: 0, // No classes allowed
        schedulingPreference: 'any',
        schedulingNotes: '',
        isActive: true,
        user: { id: 'user3', firstName: 'Bob', lastName: 'Johnson' },
        skills: [],
        blackoutDates: [],
        recurringUnavailability: [],
      },
    ])

    const weekStartDate = new Date('2025-07-07T00:00:00.000Z') // Monday
    const result = await generateSchedule({
      templateId: 'template1',
      weekStartDate,
      teamId: 'team1',
    })

    expect(result).toBeDefined()
    expect(result.newGeneratedSchedule).toBeDefined()
    expect(result.unstaffedClasses).toBe(2) // Expect both classes to be unstaffed

    // Verify scheduled classes were inserted, with coachId as null for unstaffed
    expect(db.insert).toHaveBeenCalledWith(generatedSchedulesTable)
    expect(db.insert).toHaveBeenCalledWith(scheduledClassesTable)
  })

  it('should respect skill constraints', async () => {
    // Mock coach1 to not have skill1
    db.query.coachesTable.findMany.mockResolvedValue([
      {
        id: 'coach1',
        userId: 'user1',
        teamId: 'team1',
        weeklyClassLimit: 5,
        schedulingPreference: 'morning',
        schedulingNotes: 'early bird',
        isActive: true,
        user: { id: 'user1', firstName: 'John', lastName: 'Doe' },
        skills: [], // No skills
        blackoutDates: [],
        recurringUnavailability: [],
      },
      {
        id: 'coach2',
        userId: 'user2',
        teamId: 'team1',
        weeklyClassLimit: 5,
        schedulingPreference: 'afternoon',
        schedulingNotes: 'night owl',
        isActive: true,
        user: { id: 'user2', firstName: 'Jane', lastName: 'Smith' },
        skills: [{ skillId: 'skill2', skill: { id: 'skill2', name: 'Yoga Cert' } }],
        blackoutDates: [],
        recurringUnavailability: [],
      },
    ])

    const weekStartDate = new Date('2025-07-07T00:00:00.000Z') // Monday
    const result = await generateSchedule({
      templateId: 'template1',
      weekStartDate,
      teamId: 'team1',
    })

    expect(result).toBeDefined()
    expect(result.newGeneratedSchedule).toBeDefined()
    expect(result.unstaffedClasses).toBe(1) // Expect CrossFit class to be unstaffed

    // Verify scheduled classes were inserted, with coachId as null for unstaffed
    expect(db.insert).toHaveBeenCalledWith(generatedSchedulesTable)
    expect(db.insert).toHaveBeenCalledWith(scheduledClassesTable)
  })

  it('should respect blackout dates', async () => {
    // Mock coach1 to have a blackout date for Monday 9-10 AM
    db.query.coachesTable.findMany.mockResolvedValue([
      {
        id: 'coach1',
        userId: 'user1',
        teamId: 'team1',
        weeklyClassLimit: 5,
        schedulingPreference: 'morning',
        schedulingNotes: 'early bird',
        isActive: true,
        user: { id: 'user1', firstName: 'John', lastName: 'Doe' },
        skills: [{ skillId: 'skill1', skill: { id: 'skill1', name: 'CF-L1' } }],
        blackoutDates: [
          { id: 'b1', coachId: 'coach1', startDate: new Date('2025-07-07T08:30:00.000Z'), endDate: new Date('2025-07-07T10:30:00.000Z') },
        ],
        recurringUnavailability: [],
      },
      {
        id: 'coach2',
        userId: 'user2',
        teamId: 'team1',
        weeklyClassLimit: 5,
        schedulingPreference: 'afternoon',
        schedulingNotes: 'night owl',
        isActive: true,
        user: { id: 'user2', firstName: 'Jane', lastName: 'Smith' },
        skills: [{ skillId: 'skill2', skill: { id: 'skill2', name: 'Yoga Cert' } }],
        blackoutDates: [],
        recurringUnavailability: [],
      },
    ])

    const weekStartDate = new Date('2025-07-07T00:00:00.000Z') // Monday
    const result = await generateSchedule({
      templateId: 'template1',
      weekStartDate,
      teamId: 'team1',
    })

    expect(result).toBeDefined()
    expect(result.newGeneratedSchedule).toBeDefined()
    expect(result.unstaffedClasses).toBe(1) // Expect CrossFit class to be unstaffed

    // Verify scheduled classes were inserted, with coachId as null for unstaffed
    expect(db.insert).toHaveBeenCalledWith(generatedSchedulesTable)
    expect(db.insert).toHaveBeenCalledWith(scheduledClassesTable)
  })

  it('should respect recurring unavailability', async () => {
    // Mock coach1 to have recurring unavailability for Monday 9-10 AM
    db.query.coachesTable.findMany.mockResolvedValue([
      {
        id: 'coach1',
        userId: 'user1',
        teamId: 'team1',
        weeklyClassLimit: 5,
        schedulingPreference: 'morning',
        schedulingNotes: 'early bird',
        isActive: true,
        user: { id: 'user1', firstName: 'John', lastName: 'Doe' },
        skills: [{ skillId: 'skill1', skill: { id: 'skill1', name: 'CF-L1' } }],
        blackoutDates: [],
        recurringUnavailability: [
          { id: 'ru1', coachId: 'coach1', dayOfWeek: 1, startTime: '08:30', endTime: '10:30' },
        ],
      },
      {
        id: 'coach2',
        userId: 'user2',
        teamId: 'team1',
        weeklyClassLimit: 5,
        schedulingPreference: 'afternoon',
        schedulingNotes: 'night owl',
        isActive: true,
        user: { id: 'user2', firstName: 'Jane', lastName: 'Smith' },
        skills: [{ skillId: 'skill2', skill: { id: 'skill2', name: 'Yoga Cert' } }],
        blackoutDates: [],
        recurringUnavailability: [],
      },
    ])

    const weekStartDate = new Date('2025-07-07T00:00:00.000Z') // Monday
    const result = await generateSchedule({
      templateId: 'template1',
      weekStartDate,
      teamId: 'team1',
    })

    expect(result).toBeDefined()
    expect(result.newGeneratedSchedule).toBeDefined()
    expect(result.unstaffedClasses).toBe(1) // Expect CrossFit class to be unstaffed

    // Verify scheduled classes were inserted, with coachId as null for unstaffed
    expect(db.insert).toHaveBeenCalledWith(generatedSchedulesTable)
    expect(db.insert).toHaveBeenCalledWith(scheduledClassesTable)
  })
})
