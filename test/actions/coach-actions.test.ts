import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCoach, updateCoach, deleteCoach, getCoachesByTeam, getCoachById, createCoachBlackoutDate, deleteCoachBlackoutDate, createCoachRecurringUnavailability, deleteCoachRecurringUnavailability } from '@/actions/coach-actions'
import { getDd } from '@/db'
import { coachesTable, coachToSkillsTable, coachBlackoutDatesTable, coachRecurringUnavailabilityTable } from '@/db/schemas/scheduling'
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
      coachesTable: {
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

describe('Coach Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Coaches
  it('should create a coach', async () => {
    const result = await createCoach({ userId: 'user1', teamId: 'team1', weeklyClassLimit: 10, schedulingPreference: 'morning', schedulingNotes: 'notes', isActive: true, skillIds: ['skill1', 'skill2'] })
    expect(result).toBeDefined()
    expect(mockDb?.insert).toHaveBeenCalledWith(coachesTable)
    expect(mockDb?.insert).toHaveBeenCalledWith(coachToSkillsTable)
  })

  it('should update a coach', async () => {
    const result = await updateCoach({ id: 'coach1', teamId: 'team1', weeklyClassLimit: 12, schedulingPreference: 'afternoon', schedulingNotes: 'updated notes', isActive: false, skillIds: ['skill3'] })
    expect(result).toBeDefined()
    expect(mockDb?.update).toHaveBeenCalledWith(coachesTable)
    expect(mockDb?.delete).toHaveBeenCalledWith(coachToSkillsTable)
    expect(mockDb?.insert).toHaveBeenCalledWith(coachToSkillsTable)
  })

  it('should delete a coach', async () => {
    const result = await deleteCoach({ id: 'coach1', teamId: 'team1' })
    expect(result).toBeDefined()
    expect(mockDb?.delete).toHaveBeenCalledWith(coachesTable)
  })

  it('should get coaches by team', async () => {
    const result = await getCoachesByTeam({ teamId: 'team1' })
    expect(result).toBeDefined()
    expect(mockDb?.query.coachesTable.findMany).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should get coach by id', async () => {
    const result = await getCoachById({ id: 'coach1', teamId: 'team1' })
    expect(result).toBeDefined()
    expect(mockDb?.query.coachesTable.findFirst).toHaveBeenCalledWith(expect.any(Object))
  })

  // Blackout Dates
  it('should create a coach blackout date', async () => {
    const result = await createCoachBlackoutDate({ coachId: 'coach1', startDate: new Date(), endDate: new Date(), reason: 'Vacation' })
    expect(result).toBeDefined()
    expect(mockDb?.insert).toHaveBeenCalledWith(coachBlackoutDatesTable)
  })

  it('should delete a coach blackout date', async () => {
    const result = await deleteCoachBlackoutDate({ id: 'blackout1', coachId: 'coach1' })
    expect(result).toBeDefined()
    expect(mockDb?.delete).toHaveBeenCalledWith(coachBlackoutDatesTable)
  })

  // Recurring Unavailability
  it('should create a coach recurring unavailability', async () => {
    const result = await createCoachRecurringUnavailability({ coachId: 'coach1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', description: 'Weekly Meeting' })
    expect(result).toBeDefined()
    expect(mockDb?.insert).toHaveBeenCalledWith(coachRecurringUnavailabilityTable)
  })

  it('should delete a coach recurring unavailability', async () => {
    const result = await deleteCoachRecurringUnavailability({ id: 'recurring1', coachId: 'coach1' })
    expect(result).toBeDefined()
    expect(mockDb?.delete).toHaveBeenCalledWith(coachRecurringUnavailabilityTable)
  })
})
