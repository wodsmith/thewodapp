import {describe, expect, it} from 'vitest'
import {calculateTraditionalPoints} from '@/lib/scoring/algorithms/traditional'
import type {TraditionalConfig} from '@/types/scoring'

describe('Traditional Scoring Algorithm', () => {
  describe('default config (100, step=5)', () => {
    const config: TraditionalConfig = {
      firstPlacePoints: 100,
      step: 5,
    }

    it('should award 100 points for 1st place', () => {
      expect(calculateTraditionalPoints(1, config)).toBe(100)
    })

    it('should award 95 points for 2nd place', () => {
      expect(calculateTraditionalPoints(2, config)).toBe(95)
    })

    it('should award 90 points for 3rd place', () => {
      expect(calculateTraditionalPoints(3, config)).toBe(90)
    })

    it('should award 50 points for 11th place', () => {
      // 100 - (10 * 5) = 50
      expect(calculateTraditionalPoints(11, config)).toBe(50)
    })

    it('should award 0 points for 21st place', () => {
      // 100 - (20 * 5) = 0
      expect(calculateTraditionalPoints(21, config)).toBe(0)
    })

    it('should not go below 0 points for places beyond 21', () => {
      // 100 - (25 * 5) would be -25, but should floor at 0
      expect(calculateTraditionalPoints(26, config)).toBe(0)
      expect(calculateTraditionalPoints(100, config)).toBe(0)
    })
  })

  describe('custom config (200, step=10)', () => {
    const config: TraditionalConfig = {
      firstPlacePoints: 200,
      step: 10,
    }

    it('should award 200 points for 1st place', () => {
      expect(calculateTraditionalPoints(1, config)).toBe(200)
    })

    it('should award 190 points for 2nd place', () => {
      expect(calculateTraditionalPoints(2, config)).toBe(190)
    })

    it('should award 100 points for 11th place', () => {
      // 200 - (10 * 10) = 100
      expect(calculateTraditionalPoints(11, config)).toBe(100)
    })

    it('should award 0 points for 21st place', () => {
      // 200 - (20 * 10) = 0
      expect(calculateTraditionalPoints(21, config)).toBe(0)
    })
  })

  describe('edge cases', () => {
    const config: TraditionalConfig = {
      firstPlacePoints: 100,
      step: 5,
    }

    it('should handle place 0 (invalid - returns firstPlacePoints)', () => {
      // Place 0 shouldn't happen, but if it does, treat as 1st
      expect(calculateTraditionalPoints(0, config)).toBe(100)
    })

    it('should handle negative places (returns firstPlacePoints)', () => {
      expect(calculateTraditionalPoints(-1, config)).toBe(100)
    })

    it('should handle step=0 (everyone gets first place points)', () => {
      const zeroStepConfig: TraditionalConfig = {
        firstPlacePoints: 100,
        step: 0,
      }
      expect(calculateTraditionalPoints(1, zeroStepConfig)).toBe(100)
      expect(calculateTraditionalPoints(10, zeroStepConfig)).toBe(100)
      expect(calculateTraditionalPoints(100, zeroStepConfig)).toBe(100)
    })

    it('should handle step=1 for fine-grained scoring', () => {
      const fineStepConfig: TraditionalConfig = {
        firstPlacePoints: 100,
        step: 1,
      }
      expect(calculateTraditionalPoints(1, fineStepConfig)).toBe(100)
      expect(calculateTraditionalPoints(2, fineStepConfig)).toBe(99)
      expect(calculateTraditionalPoints(50, fineStepConfig)).toBe(51)
      expect(calculateTraditionalPoints(100, fineStepConfig)).toBe(1)
      expect(calculateTraditionalPoints(101, fineStepConfig)).toBe(0)
    })
  })

  describe('batch calculation', () => {
    it('should generate a points table for 20 places', () => {
      const config: TraditionalConfig = {
        firstPlacePoints: 100,
        step: 5,
      }
      const expectedPoints = [
        100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15,
        10, 5,
      ]

      for (let place = 1; place <= 20; place++) {
        expect(calculateTraditionalPoints(place, config)).toBe(
          expectedPoints[place - 1]
        )
      }
    })
  })
})
