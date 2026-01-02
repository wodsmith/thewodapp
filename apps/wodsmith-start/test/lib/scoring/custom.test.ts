import {describe, expect, it} from 'vitest'
import {
  calculateCustomPoints,
  generatePointsTable,
  WINNER_TAKES_MORE_TABLE,
} from '@/lib/scoring/algorithms/custom'
import type {CustomTableConfig, TraditionalConfig} from '@/types/scoring'

describe('Custom Scoring Algorithm', () => {
  describe('WINNER_TAKES_MORE_TABLE constant', () => {
    it('should have 30 entries', () => {
      expect(WINNER_TAKES_MORE_TABLE).toHaveLength(30)
    })

    it('should start with 100 points for 1st place', () => {
      expect(WINNER_TAKES_MORE_TABLE[0]).toBe(100)
    })

    it('should have 85 points for 2nd place', () => {
      expect(WINNER_TAKES_MORE_TABLE[1]).toBe(85)
    })

    it('should end with 5 points for 30th place', () => {
      expect(WINNER_TAKES_MORE_TABLE[29]).toBe(5)
    })

    it('should match the full expected table', () => {
      const expected = [
        100, 85, 75, 67, 62, 58, 55, 52, 50, 48, 46, 44, 42, 40, 38, 36, 34, 32,
        30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 5,
      ]
      expect(WINNER_TAKES_MORE_TABLE).toEqual(expected)
    })
  })

  describe('generatePointsTable', () => {
    it('should generate traditional table with default config', () => {
      const traditionalConfig: TraditionalConfig = {
        firstPlacePoints: 100,
        step: 5,
      }
      const table = generatePointsTable('traditional', 10, traditionalConfig)

      expect(table).toEqual([100, 95, 90, 85, 80, 75, 70, 65, 60, 55])
    })

    it('should generate winner_takes_more table (first 10)', () => {
      const table = generatePointsTable('winner_takes_more', 10)

      expect(table).toEqual([100, 85, 75, 67, 62, 58, 55, 52, 50, 48])
    })

    it('should generate winner_takes_more table beyond 30 entries (floor at 0)', () => {
      const table = generatePointsTable('winner_takes_more', 35)

      // First 30 from table, then 0 for places 31-35
      expect(table.slice(0, 30)).toEqual(WINNER_TAKES_MORE_TABLE)
      expect(table.slice(30)).toEqual([0, 0, 0, 0, 0])
    })

    it('should generate winner_takes_more table', () => {
      const table = generatePointsTable('winner_takes_more', 10)

      // Should use winner_takes_more values
      expect(table).toEqual([100, 85, 75, 67, 62, 58, 55, 52, 50, 48])
    })
  })

  describe('calculateCustomPoints with baseTemplate=traditional', () => {
    const config: CustomTableConfig = {
      baseTemplate: 'traditional',
      overrides: {},
    }

    const traditionalConfig: TraditionalConfig = {
      firstPlacePoints: 100,
      step: 5,
    }

    it('should return traditional points when no overrides', () => {
      expect(calculateCustomPoints(1, config, traditionalConfig)).toBe(100)
      expect(calculateCustomPoints(2, config, traditionalConfig)).toBe(95)
      expect(calculateCustomPoints(10, config, traditionalConfig)).toBe(55)
    })
  })

  describe('calculateCustomPoints with baseTemplate=winner_takes_more', () => {
    const config: CustomTableConfig = {
      baseTemplate: 'winner_takes_more',
      overrides: {},
    }

    it('should return winner_takes_more points when no overrides', () => {
      expect(calculateCustomPoints(1, config)).toBe(100)
      expect(calculateCustomPoints(2, config)).toBe(85)
      expect(calculateCustomPoints(3, config)).toBe(75)
      expect(calculateCustomPoints(10, config)).toBe(48)
    })

    it('should return 0 for places beyond table length', () => {
      expect(calculateCustomPoints(31, config)).toBe(0)
      expect(calculateCustomPoints(100, config)).toBe(0)
    })
  })

  describe('calculateCustomPoints with overrides', () => {
    it('should apply place overrides', () => {
      const config: CustomTableConfig = {
        baseTemplate: 'winner_takes_more',
        overrides: {
          '1': 150, // Override 1st place to 150
          '2': 120, // Override 2nd place to 120
          '5': 70, // Override 5th place to 70
        },
      }

      expect(calculateCustomPoints(1, config)).toBe(150)
      expect(calculateCustomPoints(2, config)).toBe(120)
      expect(calculateCustomPoints(3, config)).toBe(75) // No override, uses table
      expect(calculateCustomPoints(5, config)).toBe(70)
      expect(calculateCustomPoints(10, config)).toBe(48) // No override, uses table
    })

    it('should handle string number keys in overrides', () => {
      const config: CustomTableConfig = {
        baseTemplate: 'traditional',
        overrides: {
          '1': 200,
        },
      }

      const traditionalConfig: TraditionalConfig = {
        firstPlacePoints: 100,
        step: 5,
      }

      expect(calculateCustomPoints(1, config, traditionalConfig)).toBe(200)
      expect(calculateCustomPoints(2, config, traditionalConfig)).toBe(95)
    })
  })

  describe('edge cases', () => {
    it('should handle place 0 (invalid - returns first place points)', () => {
      const config: CustomTableConfig = {
        baseTemplate: 'winner_takes_more',
        overrides: {},
      }
      expect(calculateCustomPoints(0, config)).toBe(100)
    })

    it('should handle negative places (returns first place points)', () => {
      const config: CustomTableConfig = {
        baseTemplate: 'winner_takes_more',
        overrides: {},
      }
      expect(calculateCustomPoints(-1, config)).toBe(100)
    })

    it('should allow override to 0 points', () => {
      const config: CustomTableConfig = {
        baseTemplate: 'winner_takes_more',
        overrides: {
          '10': 0,
        },
      }
      expect(calculateCustomPoints(10, config)).toBe(0)
    })

    it('should allow override beyond table length', () => {
      const config: CustomTableConfig = {
        baseTemplate: 'winner_takes_more',
        overrides: {
          '50': 3, // Override 50th place to get 3 points instead of 0
        },
      }
      expect(calculateCustomPoints(50, config)).toBe(3)
      expect(calculateCustomPoints(51, config)).toBe(0)
    })
  })

  describe('batch points generation with overrides', () => {
    it('should generate a custom table with applied overrides', () => {
      const config: CustomTableConfig = {
        baseTemplate: 'winner_takes_more',
        overrides: {
          '1': 150,
          '5': 80,
        },
      }

      const points: number[] = []
      for (let place = 1; place <= 10; place++) {
        points.push(calculateCustomPoints(place, config))
      }

      expect(points).toEqual([
        150, // Override: 150 instead of 100
        85, // From table
        75, // From table
        67, // From table
        80, // Override: 80 instead of 62
        58, // From table
        55, // From table
        52, // From table
        50, // From table
        48, // From table
      ])
    })
  })
})
