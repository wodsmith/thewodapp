import {describe, expect, it} from 'vitest'
import {
  encodeRounds,
  encodeScore,
  aggregateValues,
  formatRounds,
  decodeScore,
  getDefaultScoreType,
  type RoundInput,
  type ScoreRound,
} from '@/lib/scoring'

describe('Multi-Round Workouts', () => {
  describe('10x3 Back Squat (load, multiple rounds)', () => {
    const rounds: RoundInput[] = [
      {raw: '225'},
      {raw: '235'},
      {raw: '245'},
      {raw: '255'},
      {raw: '265'},
      {raw: '275'},
      {raw: '285'},
      {raw: '295'},
      {raw: '305'},
      {raw: '315'},
    ]

    it('should aggregate with max (highest lift)', () => {
      const result = encodeRounds(rounds, 'load', 'max', {unit: 'lbs'})
      expect(result.rounds).toHaveLength(10)
      // 315 lbs is the max
      expect(result.aggregated).toBe(Math.round(315 * 453.592))
    })

    it('should aggregate with min (lowest lift)', () => {
      const result = encodeRounds(rounds, 'load', 'min', {unit: 'lbs'})
      // 225 lbs is the min
      expect(result.aggregated).toBe(Math.round(225 * 453.592))
    })

    it('should aggregate with sum (total volume)', () => {
      const result = encodeRounds(rounds, 'load', 'sum', {unit: 'lbs'})
      // Sum: 225+235+245+255+265+275+285+295+305+315 = 2700 lbs
      // Note: Small rounding differences occur when summing individually rounded values
      // vs rounding the total. We allow 1 gram tolerance.
      const expectedSum = 2700
      const expectedGrams = Math.round(expectedSum * 453.592)
      expect(result.aggregated).toBeGreaterThanOrEqual(expectedGrams - 10)
      expect(result.aggregated).toBeLessThanOrEqual(expectedGrams + 10)
    })

    it('should aggregate with average', () => {
      const result = encodeRounds(rounds, 'load', 'average', {unit: 'lbs'})
      // Average: 2700 / 10 = 270 lbs
      expect(result.aggregated).toBe(Math.round(270 * 453.592))
    })

    it('should aggregate with first (first attempt)', () => {
      const result = encodeRounds(rounds, 'load', 'first', {unit: 'lbs'})
      expect(result.aggregated).toBe(Math.round(225 * 453.592))
    })

    it('should aggregate with last (last attempt)', () => {
      const result = encodeRounds(rounds, 'load', 'last', {unit: 'lbs'})
      expect(result.aggregated).toBe(Math.round(315 * 453.592))
    })

    it('should format all rounds for display', () => {
      const result = encodeRounds(rounds, 'load', 'max', {unit: 'lbs'})
      const scoreRounds: ScoreRound[] = result.rounds.map((value, i) => ({
        roundNumber: i + 1,
        value,
      }))
      const formatted = formatRounds(scoreRounds, 'load', {
        weightUnit: 'lbs',
        includeUnit: true,
      })
      expect(formatted).toEqual([
        '225 lbs',
        '235 lbs',
        '245 lbs',
        '255 lbs',
        '265 lbs',
        '275 lbs',
        '285 lbs',
        '295 lbs',
        '305 lbs',
        '315 lbs',
      ])
    })
  })

  describe('3 Rounds For Time (time, multiple rounds)', () => {
    const rounds: RoundInput[] = [
      {raw: '5:00'}, // Round 1: 5:00
      {raw: '4:45'}, // Round 2: 4:45
      {raw: '5:10'}, // Round 3: 5:10
    ]

    it('should aggregate with sum (total time)', () => {
      const result = encodeRounds(rounds, 'time', 'sum')
      // 5:00 + 4:45 + 5:10 = 14:55 = 895 seconds = 895000 ms
      expect(result.aggregated).toBe(895000)
    })

    it('should aggregate with min (fastest round)', () => {
      const result = encodeRounds(rounds, 'time', 'min')
      // Fastest: 4:45 = 285000 ms
      expect(result.aggregated).toBe(285000)
    })

    it('should aggregate with max (slowest round)', () => {
      const result = encodeRounds(rounds, 'time', 'max')
      // Slowest: 5:10 = 310000 ms
      expect(result.aggregated).toBe(310000)
    })

    it('should aggregate with average', () => {
      const result = encodeRounds(rounds, 'time', 'average')
      // Average: 895000 / 3 = 298333 ms (rounded)
      expect(result.aggregated).toBe(298333)
    })

    it('should format rounds for display', () => {
      const result = encodeRounds(rounds, 'time', 'sum')
      const scoreRounds: ScoreRound[] = result.rounds.map((value, i) => ({
        roundNumber: i + 1,
        value,
      }))
      const formatted = formatRounds(scoreRounds, 'time')
      expect(formatted).toEqual(['5:00', '4:45', '5:10'])
    })
  })

  describe('5 Rounds of Max Reps (reps, multiple rounds)', () => {
    const rounds: RoundInput[] = [
      {raw: '25'},
      {raw: '22'},
      {raw: '20'},
      {raw: '18'},
      {raw: '15'},
    ]

    it('should aggregate with sum (total reps)', () => {
      const result = encodeRounds(rounds, 'reps', 'sum')
      // 25 + 22 + 20 + 18 + 15 = 100
      expect(result.aggregated).toBe(100)
    })

    it('should aggregate with max (best round)', () => {
      const result = encodeRounds(rounds, 'reps', 'max')
      expect(result.aggregated).toBe(25)
    })

    it('should aggregate with min (worst round)', () => {
      const result = encodeRounds(rounds, 'reps', 'min')
      expect(result.aggregated).toBe(15)
    })

    it('should aggregate with average', () => {
      const result = encodeRounds(rounds, 'reps', 'average')
      // 100 / 5 = 20
      expect(result.aggregated).toBe(20)
    })
  })

  describe('5K Row Split Times (time, distance intervals)', () => {
    // 5K row with 500m split times
    const rounds: RoundInput[] = [
      {raw: '1:52'}, // 500m
      {raw: '1:54'},
      {raw: '1:55'},
      {raw: '1:56'},
      {raw: '1:58'},
      {raw: '2:00'},
      {raw: '1:58'},
      {raw: '1:55'},
      {raw: '1:52'},
      {raw: '1:48'}, // Sprint finish
    ]

    it('should aggregate with sum (total time)', () => {
      const result = encodeRounds(rounds, 'time', 'sum')
      // Total should be sum of all splits
      const expected =
        (112 + 114 + 115 + 116 + 118 + 120 + 118 + 115 + 112 + 108) * 1000
      expect(result.aggregated).toBe(expected)
    })

    it('should aggregate with min (fastest split)', () => {
      const result = encodeRounds(rounds, 'time', 'min')
      // Fastest: 1:48 = 108000 ms
      expect(result.aggregated).toBe(108000)
    })

    it('should aggregate with average (average split)', () => {
      const result = encodeRounds(rounds, 'time', 'average')
      // Average of splits
      const totalSeconds =
        112 + 114 + 115 + 116 + 118 + 120 + 118 + 115 + 112 + 108
      expect(result.aggregated).toBe(Math.round((totalSeconds * 1000) / 10))
    })
  })

  describe('CrossFit Total (load, 3 lifts)', () => {
    // Back Squat, Press, Deadlift - each with best of 3 attempts

    it('should handle nested aggregation (best of each, then sum)', () => {
      // Back Squat attempts
      const squatAttempts: RoundInput[] = [
        {raw: '315'},
        {raw: '335'},
        {raw: '350'}, // Best
      ]
      const squatResult = encodeRounds(squatAttempts, 'load', 'max', {
        unit: 'lbs',
      })

      // Press attempts
      const pressAttempts: RoundInput[] = [
        {raw: '155'},
        {raw: '165'}, // Best
        {raw: '0'}, // Failed
      ]
      const pressResult = encodeRounds(pressAttempts, 'load', 'max', {
        unit: 'lbs',
      })

      // Deadlift attempts
      const deadliftAttempts: RoundInput[] = [
        {raw: '405'},
        {raw: '425'},
        {raw: '445'}, // Best
      ]
      const deadliftResult = encodeRounds(deadliftAttempts, 'load', 'max', {
        unit: 'lbs',
      })

      // Sum the bests
      const totals = [
        squatResult.aggregated!,
        pressResult.aggregated!,
        deadliftResult.aggregated!,
      ]
      const total = aggregateValues(totals, 'sum')

      // 350 + 165 + 445 = 960 lbs
      expect(total).toBe(Math.round(960 * 453.592))
    })
  })

  describe('EMOM with varying rep counts', () => {
    // 10 min EMOM: Max reps each minute
    const rounds: RoundInput[] = [
      {raw: '15'},
      {raw: '14'},
      {raw: '13'},
      {raw: '12'},
      {raw: '12'},
      {raw: '11'},
      {raw: '10'},
      {raw: '10'},
      {raw: '9'},
      {raw: '8'},
    ]

    it('should aggregate with sum (total reps)', () => {
      const result = encodeRounds(rounds, 'reps', 'sum')
      // 15+14+13+12+12+11+10+10+9+8 = 114
      expect(result.aggregated).toBe(114)
    })

    it('should identify best minute with max', () => {
      const result = encodeRounds(rounds, 'reps', 'max')
      expect(result.aggregated).toBe(15)
    })

    it('should identify worst minute with min', () => {
      const result = encodeRounds(rounds, 'reps', 'min')
      expect(result.aggregated).toBe(8)
    })
  })

  describe('Mixed scheme rounds (rare but supported)', () => {
    it('should handle rounds with scheme overrides', () => {
      // Workout with different measurements per round
      const rounds: RoundInput[] = [
        {raw: '225', schemeOverride: 'load'}, // Deadlift weight
        {raw: '50', schemeOverride: 'reps'}, // Box jumps
        {raw: '2:30', schemeOverride: 'time'}, // 400m run time
      ]

      const result = encodeRounds(rounds, 'reps', 'sum') // Default scheme doesn't matter much here

      // Each round encoded with its override scheme
      expect(result.rounds).toHaveLength(3)
      expect(result.rounds[0]).toBe(Math.round(225 * 453.592)) // Load in grams
      expect(result.rounds[1]).toBe(50) // Reps as integer
      expect(result.rounds[2]).toBe(150000) // Time in ms
    })
  })

  describe('Calories across rounds', () => {
    // 4 rounds of max cal in 1 minute
    const rounds: RoundInput[] = [
      {raw: '22'},
      {raw: '20'},
      {raw: '18'},
      {raw: '16'},
    ]

    it('should aggregate calories with sum', () => {
      const result = encodeRounds(rounds, 'calories', 'sum')
      expect(result.aggregated).toBe(76)
    })

    it('should aggregate calories with average', () => {
      const result = encodeRounds(rounds, 'calories', 'average')
      expect(result.aggregated).toBe(19)
    })
  })

  describe('Distance across rounds', () => {
    // 4x400m repeats
    const rounds: RoundInput[] = [
      {raw: '400'},
      {raw: '400'},
      {raw: '400'},
      {raw: '400'},
    ]

    it('should aggregate distance with sum (total distance)', () => {
      const result = encodeRounds(rounds, 'meters', 'sum')
      // 4 * 400m = 1600m = 1,600,000 mm
      expect(result.aggregated).toBe(1600000)
    })
  })

  describe('Points across rounds', () => {
    // Multi-event competition scoring
    const rounds: RoundInput[] = [
      {raw: '100'}, // Event 1
      {raw: '85'}, // Event 2
      {raw: '90'}, // Event 3
      {raw: '75'}, // Event 4
    ]

    it('should aggregate points with sum', () => {
      const result = encodeRounds(rounds, 'points', 'sum')
      expect(result.aggregated).toBe(350)
    })

    it('should find best event with max', () => {
      const result = encodeRounds(rounds, 'points', 'max')
      expect(result.aggregated).toBe(100)
    })

    it('should find worst event with min', () => {
      const result = encodeRounds(rounds, 'points', 'min')
      expect(result.aggregated).toBe(75)
    })
  })

  describe('Empty and single round edge cases', () => {
    it('should handle empty rounds array', () => {
      const result = encodeRounds([], 'time', 'sum')
      expect(result.rounds).toHaveLength(0)
      expect(result.aggregated).toBeNull()
    })

    it('should handle single round', () => {
      const result = encodeRounds([{raw: '5:00'}], 'time', 'sum')
      expect(result.rounds).toHaveLength(1)
      expect(result.aggregated).toBe(300000)
    })

    it('should skip invalid rounds', () => {
      const rounds: RoundInput[] = [
        {raw: '5:00'},
        {raw: 'invalid'},
        {raw: '4:30'},
      ]
      const result = encodeRounds(rounds, 'time', 'sum')
      expect(result.rounds).toHaveLength(2)
      expect(result.aggregated).toBe(570000) // 5:00 + 4:30
    })
  })

  describe('Default score types for schemes', () => {
    it('should default to min for time schemes', () => {
      expect(getDefaultScoreType('time')).toBe('min')
      expect(getDefaultScoreType('time-with-cap')).toBe('min')
    })

    it('should default to max for quantity schemes', () => {
      expect(getDefaultScoreType('reps')).toBe('max')
      expect(getDefaultScoreType('rounds-reps')).toBe('max')
      expect(getDefaultScoreType('load')).toBe('max')
      expect(getDefaultScoreType('calories')).toBe('max')
      expect(getDefaultScoreType('meters')).toBe('max')
      expect(getDefaultScoreType('feet')).toBe('max')
      expect(getDefaultScoreType('points')).toBe('max')
    })

    it('should default to first for pass-fail', () => {
      expect(getDefaultScoreType('pass-fail')).toBe('first')
    })
  })

  describe('Time with milliseconds across rounds', () => {
    const rounds: RoundInput[] = [
      {raw: '1:23.456'},
      {raw: '1:22.789'},
      {raw: '1:24.123'},
    ]

    it('should preserve millisecond precision in sum', () => {
      const result = encodeRounds(rounds, 'time', 'sum')
      // 83.456 + 82.789 + 84.123 = 250.368 seconds = 250368 ms
      expect(result.aggregated).toBe(250368)
    })

    it('should preserve millisecond precision in min', () => {
      const result = encodeRounds(rounds, 'time', 'min')
      // Fastest: 1:22.789 = 82789 ms
      expect(result.aggregated).toBe(82789)
    })

    it('should format rounds with milliseconds', () => {
      const result = encodeRounds(rounds, 'time', 'sum')
      const scoreRounds: ScoreRound[] = result.rounds.map((value, i) => ({
        roundNumber: i + 1,
        value,
      }))
      const formatted = formatRounds(scoreRounds, 'time')
      expect(formatted).toEqual(['1:23.456', '1:22.789', '1:24.123'])
    })
  })
})

describe('aggregateValues edge cases', () => {
  it('should return null for empty array with any score type', () => {
    expect(aggregateValues([], 'min')).toBeNull()
    expect(aggregateValues([], 'max')).toBeNull()
    expect(aggregateValues([], 'sum')).toBeNull()
    expect(aggregateValues([], 'average')).toBeNull()
    expect(aggregateValues([], 'first')).toBeNull()
    expect(aggregateValues([], 'last')).toBeNull()
  })

  it('should handle single value correctly for all score types', () => {
    expect(aggregateValues([100], 'min')).toBe(100)
    expect(aggregateValues([100], 'max')).toBe(100)
    expect(aggregateValues([100], 'sum')).toBe(100)
    expect(aggregateValues([100], 'average')).toBe(100)
    expect(aggregateValues([100], 'first')).toBe(100)
    expect(aggregateValues([100], 'last')).toBe(100)
  })

  it('should handle two values correctly', () => {
    expect(aggregateValues([100, 200], 'min')).toBe(100)
    expect(aggregateValues([100, 200], 'max')).toBe(200)
    expect(aggregateValues([100, 200], 'sum')).toBe(300)
    expect(aggregateValues([100, 200], 'average')).toBe(150)
    expect(aggregateValues([100, 200], 'first')).toBe(100)
    expect(aggregateValues([100, 200], 'last')).toBe(200)
  })

  it('should handle identical values', () => {
    expect(aggregateValues([100, 100, 100], 'min')).toBe(100)
    expect(aggregateValues([100, 100, 100], 'max')).toBe(100)
    expect(aggregateValues([100, 100, 100], 'sum')).toBe(300)
    expect(aggregateValues([100, 100, 100], 'average')).toBe(100)
  })

  it('should round average to nearest integer', () => {
    // 100 + 101 = 201, 201 / 2 = 100.5, rounds to 101
    expect(aggregateValues([100, 101], 'average')).toBe(101)
    // 100 + 102 = 202, 202 / 2 = 101
    expect(aggregateValues([100, 102], 'average')).toBe(101)
  })

  it('should handle zero values', () => {
    expect(aggregateValues([0, 100, 0], 'min')).toBe(0)
    expect(aggregateValues([0, 100, 0], 'max')).toBe(100)
    expect(aggregateValues([0, 100, 0], 'sum')).toBe(100)
    expect(aggregateValues([0, 0, 0], 'average')).toBe(0)
  })

  it('should handle large values', () => {
    const large = [1000000, 2000000, 3000000]
    expect(aggregateValues(large, 'sum')).toBe(6000000)
    expect(aggregateValues(large, 'average')).toBe(2000000)
  })
})
