import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLocation, updateLocation, deleteLocation, getLocationsByTeam, createClassCatalog, updateClassCatalog, deleteClassCatalog, getClassCatalogByTeam, createSkill, updateSkill, deleteSkill, getSkillsByTeam } from '@/actions/gym-setup-actions'
import { getDd } from '@/db'

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
      locationsTable: {
        findMany: vi.fn(() => ([{}]))
      },
      classCatalogTable: {
        findMany: vi.fn(() => ([{}]))
      },
      skillsTable: {
        findMany: vi.fn(() => ([{}]))
      }
    }
  }

vi.mock('@/db', () => ({
  getDd: vi.fn(() => mockDb)
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => ({ user: { id: 'test-user-id' } }))
}))

describe('Gym Setup Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Locations
  it('should create a location', async () => {
    const result = await createLocation({ teamId: 'test-team-id', name: 'Test Location', capacity: 20 })
    expect(result).toBeDefined()

    expect(mockDb?.insert).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should update a location', async () => {
    const result = await updateLocation({ id: 'loc1', teamId: 'test-team-id', name: 'Updated Location', capacity: 25 })
    expect(result).toBeDefined()

    expect(mockDb?.update).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should delete a location', async () => {
    const result = await deleteLocation({ id: 'loc1', teamId: 'test-team-id' })
    expect(result).toBeDefined()

    expect(mockDb?.delete).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should get locations by team', async () => {
    const result = await getLocationsByTeam({ teamId: 'test-team-id' })
    expect(result).toBeDefined()

    expect(mockDb?.query.locationsTable.findMany).toHaveBeenCalledWith(expect.any(Object))
  })

  // Class Catalog
  it('should create a class catalog entry', async () => {
    const result = await createClassCatalog({ 
      teamId: 'test-team-id', 
      name: 'Test Class', 
      description: 'Desc',
      durationMinutes: 60,
      maxParticipants: 10
    })
    expect(result).toBeDefined()

    expect(mockDb?.insert).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should update a class catalog entry', async () => {
    const result = await updateClassCatalog({ 
      id: 'cls1', 
      teamId: 'test-team-id', 
      name: 'Updated Class', 
      description: 'Updated Desc',
      durationMinutes: 90,
      maxParticipants: 15
    })
    expect(result).toBeDefined()

    expect(mockDb?.update).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should delete a class catalog entry', async () => {
    const result = await deleteClassCatalog({ id: 'cls1', teamId: 'test-team-id' })
    expect(result).toBeDefined()

    expect(mockDb?.delete).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should get class catalog by team', async () => {
    const result = await getClassCatalogByTeam({ teamId: 'test-team-id' })
    expect(result).toBeDefined()

    expect(mockDb?.query.classCatalogTable.findMany).toHaveBeenCalledWith(expect.any(Object))
  })

  // Skills
  it('should create a skill', async () => {
    const result = await createSkill({ teamId: 'test-team-id', name: 'Test Skill' })
    expect(result).toBeDefined()

    expect(mockDb?.insert).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should update a skill', async () => {
    const result = await updateSkill({ id: 'skill1', teamId: 'test-team-id', name: 'Updated Skill' })
    expect(result).toBeDefined()

    expect(mockDb?.update).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should delete a skill', async () => {
    const result = await deleteSkill({ id: 'skill1', teamId: 'test-team-id' })
    expect(result).toBeDefined()

    expect(mockDb?.delete).toHaveBeenCalledWith(expect.any(Object))
  })

  it('should get skills by team', async () => {
    const result = await getSkillsByTeam({ teamId: 'test-team-id' })
    expect(result).toBeDefined()

    expect(mockDb?.query.skillsTable.findMany).toHaveBeenCalledWith(expect.any(Object))
  })
})
