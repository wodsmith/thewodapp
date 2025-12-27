import {describe, expect, it} from 'vitest'
import {calculateRequiredJudges} from '@/server/judge-scheduling'

describe('calculateRequiredJudges', () => {
  describe('basic calculations', () => {
    it('returns 0 for empty heats array', () => {
      expect(calculateRequiredJudges([])).toBe(0)
    })

    it('calculates for single heat with default rotation length', () => {
      const heats = [{heatNumber: 1, laneCount: 5}]
      // 1 heat, 5 lanes = 5 slots
      // With rotation length 3, a judge covers 3 slots
      // But we need 5 judges per heat minimum
      const result = calculateRequiredJudges(heats)
      expect(result).toBe(5)
    })

    it('calculates for multiple heats with uniform lanes', () => {
      const heats = [
        {heatNumber: 1, laneCount: 4},
        {heatNumber: 2, laneCount: 4},
        {heatNumber: 3, laneCount: 4},
      ]
      // 3 heats, 4 lanes = 12 total slots
      // With rotation length 3, need 12 / (3 * 4) = 1 minimum
      // But need 4 judges per heat, so minimum is 4
      const result = calculateRequiredJudges(heats)
      expect(result).toBe(4)
    })
  })

  describe('varying lane counts', () => {
    it('uses average lane count for calculation', () => {
      const heats = [
        {heatNumber: 1, laneCount: 2},
        {heatNumber: 2, laneCount: 4},
        {heatNumber: 3, laneCount: 6},
      ]
      // Avg lanes = (2+4+6)/3 = 4
      // Total slots = 12
      const result = calculateRequiredJudges(heats)
      expect(result).toBeGreaterThanOrEqual(4)
    })
  })

  describe('custom rotation length', () => {
    it('adjusts for shorter rotation length', () => {
      const heats = [
        {heatNumber: 1, laneCount: 4},
        {heatNumber: 2, laneCount: 4},
        {heatNumber: 3, laneCount: 4},
        {heatNumber: 4, laneCount: 4},
      ]
      // With rotation length 2, judges work fewer heats
      // Need more judges overall
      const shortRotation = calculateRequiredJudges(heats, 2)
      const longRotation = calculateRequiredJudges(heats, 4)

      // Shorter rotations should require same or more judges
      expect(shortRotation).toBeGreaterThanOrEqual(longRotation)
    })

    it('handles rotation length of 1', () => {
      const heats = [
        {heatNumber: 1, laneCount: 3},
        {heatNumber: 2, laneCount: 3},
      ]
      // With rotation length 1, each judge only works 1 heat
      const result = calculateRequiredJudges(heats, 1)
      // Need at least 3 per heat
      expect(result).toBeGreaterThanOrEqual(3)
    })
  })

  describe('edge cases', () => {
    it('handles single lane heats', () => {
      const heats = [
        {heatNumber: 1, laneCount: 1},
        {heatNumber: 2, laneCount: 1},
        {heatNumber: 3, laneCount: 1},
      ]
      // 3 heats, 1 lane each = 3 total slots
      const result = calculateRequiredJudges(heats)
      expect(result).toBe(1)
    })

    it('handles many heats with few lanes', () => {
      const heats = Array.from({length: 10}, (_, i) => ({
        heatNumber: i + 1,
        laneCount: 2,
      }))
      // 10 heats, 2 lanes = 20 slots
      const result = calculateRequiredJudges(heats)
      expect(result).toBeGreaterThanOrEqual(2)
    })

    it('handles few heats with many lanes', () => {
      const heats = [
        {heatNumber: 1, laneCount: 20},
        {heatNumber: 2, laneCount: 20},
      ]
      // 2 heats, 20 lanes = 40 slots
      // Need at least 20 judges per heat
      const result = calculateRequiredJudges(heats)
      expect(result).toBe(20)
    })
  })
})
