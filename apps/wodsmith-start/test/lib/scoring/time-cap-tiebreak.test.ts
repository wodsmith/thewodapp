import {describe, expect, it} from 'vitest'
import {
  parseScore,
  parseTiebreak,
  encodeScore,
  decodeScore,
  formatScore,
  formatScoreWithTiebreak,
  compareScores,
  sortScores,
  computeSortKey,
  findRank,
  type Score,
} from '@/lib/scoring'

describe('Time Cap Scenarios', () => {
  describe('Athlete finishes under time cap', () => {
    it('should encode and decode finish time correctly', () => {
      // 15:00 cap, athlete finishes in 12:34
      const encoded = encodeScore('12:34', 'time-with-cap')
      expect(encoded).toBe(754000)

      const decoded = decodeScore(754000, 'time-with-cap')
      expect(decoded).toBe('12:34')
    })

    it('should format as time when finished', () => {
      const score: Score = {
        scheme: 'time-with-cap',
        scoreType: 'min',
        value: 754000, // 12:34
        status: 'scored',
        timeCap: {
          ms: 900000, // 15:00 cap
          secondaryValue: 0,
        },
      }
      expect(formatScore(score)).toBe('12:34')
    })
  })

  describe('Athlete hits time cap', () => {
    it('should format capped score with reps', () => {
      const score: Score = {
        scheme: 'time-with-cap',
        scoreType: 'min',
        value: null, // Didn't finish
        status: 'cap',
        timeCap: {
          ms: 900000, // 15:00 cap
          secondaryValue: 142,
        },
      }
      expect(formatScore(score)).toBe('CAP (142 reps)')
    })

    it('should format capped score without status prefix', () => {
      const score: Score = {
        scheme: 'time-with-cap',
        scoreType: 'min',
        value: null,
        status: 'cap',
        timeCap: {
          ms: 900000,
          secondaryValue: 142,
        },
      }
      expect(formatScore(score, {showStatus: false})).toBe('142 reps')
    })

    // Note: Secondary scheme is now always reps for time-capped workouts
  })

  describe('Sorting finished vs capped athletes', () => {
    it('should sort finished athletes before capped athletes', () => {
      const scores: Score[] = [
        // Capped with 150 reps
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'cap',
          timeCap: {ms: 900000, secondaryValue: 150},
        },
        // Finished in 12:00
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: 720000,
          status: 'scored',
        },
        // Finished in 8:30
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: 510000,
          status: 'scored',
        },
      ]

      const sorted = sortScores([...scores])

      // Fastest finished first
      expect(sorted[0]?.value).toBe(510000) // 8:30
      expect(sorted[0]?.status).toBe('scored')
      // Second fastest
      expect(sorted[1]?.value).toBe(720000) // 12:00
      expect(sorted[1]?.status).toBe('scored')
      // Capped last
      expect(sorted[2]?.status).toBe('cap')
    })

    it('should sort capped athletes by secondary value (higher is better)', () => {
      const scores: Score[] = [
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'cap',
          timeCap: {ms: 900000, secondaryValue: 100},
        },
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'cap',
          timeCap: {ms: 900000, secondaryValue: 150},
        },
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'cap',
          timeCap: {ms: 900000, secondaryValue: 125},
        },
      ]

      const sorted = sortScores([...scores])

      // Highest reps first among capped
      expect(sorted[0]?.timeCap?.secondaryValue).toBe(150)
      expect(sorted[1]?.timeCap?.secondaryValue).toBe(125)
      expect(sorted[2]?.timeCap?.secondaryValue).toBe(100)
    })

    it('should handle mixed finished and capped correctly', () => {
      const scores: Score[] = [
        // Capped with 200 reps (good)
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'cap',
          timeCap: {ms: 900000, secondaryValue: 200},
        },
        // Finished slowly (14:59)
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: 899000,
          status: 'scored',
        },
        // Capped with 50 reps (bad)
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'cap',
          timeCap: {ms: 900000, secondaryValue: 50},
        },
        // Finished fast (8:30)
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: 510000,
          status: 'scored',
        },
      ]

      const sorted = sortScores([...scores])

      // Finished athletes first (by time)
      expect(sorted[0]?.value).toBe(510000) // 8:30 - fastest
      expect(sorted[0]?.status).toBe('scored')
      expect(sorted[1]?.value).toBe(899000) // 14:59 - slow but finished
      expect(sorted[1]?.status).toBe('scored')
      // Capped athletes after (by reps)
      expect(sorted[2]?.timeCap?.secondaryValue).toBe(200)
      expect(sorted[2]?.status).toBe('cap')
      expect(sorted[3]?.timeCap?.secondaryValue).toBe(50)
      expect(sorted[3]?.status).toBe('cap')
    })
  })
})

describe('Tiebreak Scenarios', () => {
  describe('AMRAP with time tiebreak', () => {
    it('should parse and encode tiebreak time', () => {
      const mainScore = parseScore('5+12', 'rounds-reps')
      const tiebreak = parseTiebreak('8:30', 'time')

      expect(mainScore.isValid).toBe(true)
      expect(mainScore.encoded).toBe(500012)
      expect(tiebreak.isValid).toBe(true)
      expect(tiebreak.encoded).toBe(510000) // 8:30 in ms
    })

    it('should format score with tiebreak', () => {
      const score: Score = {
        scheme: 'rounds-reps',
        scoreType: 'max',
        value: 500012, // 5+12
        status: 'scored',
        tiebreak: {
          scheme: 'time',
          value: 510000, // 8:30
        },
      }
      expect(formatScoreWithTiebreak(score)).toBe('05+12 (TB: 8:30)')
    })

    it('should sort by tiebreak when primary scores are equal', () => {
      const scores: Score[] = [
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 500012,
          status: 'scored',
          tiebreak: {scheme: 'time', value: 600000}, // 10:00
        },
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 500012,
          status: 'scored',
          tiebreak: {scheme: 'time', value: 510000}, // 8:30
        },
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 500012,
          status: 'scored',
          tiebreak: {scheme: 'time', value: 540000}, // 9:00
        },
      ]

      const sorted = sortScores([...scores])

      // Same rounds+reps, sorted by tiebreak time (lower is better)
      expect(sorted[0]?.tiebreak?.value).toBe(510000) // 8:30
      expect(sorted[1]?.tiebreak?.value).toBe(540000) // 9:00
      expect(sorted[2]?.tiebreak?.value).toBe(600000) // 10:00
    })
  })

  describe('For Time with reps tiebreak', () => {
    it('should parse reps tiebreak', () => {
      const mainScore = parseScore('12:34', 'time')
      const tiebreak = parseTiebreak('150', 'reps')

      expect(mainScore.isValid).toBe(true)
      expect(tiebreak.isValid).toBe(true)
      expect(tiebreak.encoded).toBe(150)
    })

    it('should format score with reps tiebreak', () => {
      const score: Score = {
        scheme: 'time',
        scoreType: 'min',
        value: 754000, // 12:34
        status: 'scored',
        tiebreak: {
          scheme: 'reps',
          value: 150,
        },
      }
      expect(formatScoreWithTiebreak(score)).toBe('12:34 (TB: 150)')
    })

    it('should sort by reps tiebreak (higher is better)', () => {
      const scores: Score[] = [
        {
          scheme: 'time',
          scoreType: 'min',
          value: 754000, // Same time
          status: 'scored',
          tiebreak: {scheme: 'reps', value: 100},
        },
        {
          scheme: 'time',
          scoreType: 'min',
          value: 754000,
          status: 'scored',
          tiebreak: {scheme: 'reps', value: 150},
        },
        {
          scheme: 'time',
          scoreType: 'min',
          value: 754000,
          status: 'scored',
          tiebreak: {scheme: 'reps', value: 125},
        },
      ]

      const sorted = sortScores([...scores])

      // Same time, sorted by reps tiebreak (higher is better)
      expect(sorted[0]?.tiebreak?.value).toBe(150)
      expect(sorted[1]?.tiebreak?.value).toBe(125)
      expect(sorted[2]?.tiebreak?.value).toBe(100)
    })
  })

  describe('Tiebreak edge cases', () => {
    it('should handle score without tiebreak vs score with tiebreak', () => {
      const scores: Score[] = [
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 500012,
          status: 'scored',
          // No tiebreak
        },
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 500012,
          status: 'scored',
          tiebreak: {scheme: 'time', value: 510000},
        },
      ]

      // Both should be considered equal (having tiebreak doesn't change position when comparing to no-tiebreak)
      const result = compareScores(scores[0]!, scores[1]!)
      expect(result).toBe(0)
    })

    it('should prioritize primary score over tiebreak', () => {
      const scores: Score[] = [
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 500010, // 5+10 (worse)
          status: 'scored',
          tiebreak: {scheme: 'time', value: 300000}, // 5:00 (great tiebreak)
        },
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 500015, // 5+15 (better)
          status: 'scored',
          tiebreak: {scheme: 'time', value: 600000}, // 10:00 (bad tiebreak)
        },
      ]

      const sorted = sortScores([...scores])

      // Higher rounds+reps wins despite worse tiebreak
      expect(sorted[0]?.value).toBe(500015)
      expect(sorted[1]?.value).toBe(500010)
    })
  })
})

describe('Complex Sorting Scenarios', () => {
  describe('Full competition leaderboard', () => {
    it('should correctly sort a realistic competition field', () => {
      const scores: Score[] = [
        // Athlete A: Finished 8:30
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: 510000,
          status: 'scored',
          tiebreak: {scheme: 'reps', value: 75},
        },
        // Athlete B: Finished 8:30 with better tiebreak
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: 510000,
          status: 'scored',
          tiebreak: {scheme: 'reps', value: 90},
        },
        // Athlete C: Capped with 180 reps
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'cap',
          timeCap: {ms: 900000, secondaryValue: 180},
        },
        // Athlete D: DQ
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'dq',
        },
        // Athlete E: Finished 10:00
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: 600000,
          status: 'scored',
        },
        // Athlete F: Withdrawn
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'withdrawn',
        },
        // Athlete G: Capped with 150 reps
        {
          scheme: 'time-with-cap',
          scoreType: 'min',
          value: null,
          status: 'cap',
          timeCap: {ms: 900000, secondaryValue: 150},
        },
      ]

      const sorted = sortScores([...scores])

      // Expected order:
      // 1. B: 8:30 + 90 reps tiebreak (best tiebreak)
      // 2. A: 8:30 + 75 reps tiebreak
      // 3. E: 10:00
      // 4. C: CAP 180 reps (most reps among capped)
      // 5. G: CAP 150 reps
      // 6. D: DQ
      // 7. F: Withdrawn

      expect(sorted[0]?.status).toBe('scored')
      expect(sorted[0]?.tiebreak?.value).toBe(90) // B
      expect(sorted[1]?.status).toBe('scored')
      expect(sorted[1]?.tiebreak?.value).toBe(75) // A
      expect(sorted[2]?.value).toBe(600000) // E: 10:00
      expect(sorted[3]?.status).toBe('cap')
      expect(sorted[3]?.timeCap?.secondaryValue).toBe(180) // C
      expect(sorted[4]?.status).toBe('cap')
      expect(sorted[4]?.timeCap?.secondaryValue).toBe(150) // G
      expect(sorted[5]?.status).toBe('dq') // D
      expect(sorted[6]?.status).toBe('withdrawn') // F
    })
  })

  describe('Ranks', () => {
    it('should find correct rank in a field', () => {
      const scores: Score[] = [
        {scheme: 'time', scoreType: 'min', value: 600000, status: 'scored'},
        {scheme: 'time', scoreType: 'min', value: 510000, status: 'scored'},
        {scheme: 'time', scoreType: 'min', value: 720000, status: 'scored'},
        {scheme: 'time', scoreType: 'min', value: 540000, status: 'scored'},
      ]

      // Find rank of 540000 (should be 2nd)
      const target: Score = {
        scheme: 'time',
        scoreType: 'min',
        value: 540000,
        status: 'scored',
      }

      const rank = findRank(target, scores)
      expect(rank).toBe(2) // 510000, then 540000
    })

    it('should handle tied ranks', () => {
      const scores: Score[] = [
        {scheme: 'time', scoreType: 'min', value: 510000, status: 'scored'},
        {scheme: 'time', scoreType: 'min', value: 540000, status: 'scored'},
        {scheme: 'time', scoreType: 'min', value: 540000, status: 'scored'}, // Tied
        {scheme: 'time', scoreType: 'min', value: 600000, status: 'scored'},
      ]

      // Both 540000 scores would find rank 2
      const target: Score = {
        scheme: 'time',
        scoreType: 'min',
        value: 540000,
        status: 'scored',
      }

      const rank = findRank(target, scores)
      expect(rank).toBe(2)
    })
  })

  describe('Sort key consistency', () => {
    it('should produce consistent sort keys for comparison', () => {
      const scoreA: Score = {
        scheme: 'time',
        scoreType: 'min',
        value: 510000,
        status: 'scored',
      }
      const scoreB: Score = {
        scheme: 'time',
        scoreType: 'min',
        value: 720000,
        status: 'scored',
      }

      const keyA = computeSortKey(scoreA)
      const keyB = computeSortKey(scoreB)

      // For time (lower is better), keyA should be less than keyB
      expect(keyA).toBeLessThan(keyB)
    })

    it('should produce consistent sort keys for status ordering', () => {
      const scored: Score = {
        scheme: 'time',
        scoreType: 'min',
        value: 900000, // Slow time
        status: 'scored',
      }
      const capped: Score = {
        scheme: 'time',
        scoreType: 'min',
        value: null,
        status: 'cap',
      }
      const dq: Score = {
        scheme: 'time',
        scoreType: 'min',
        value: null,
        status: 'dq',
      }
      const withdrawn: Score = {
        scheme: 'time',
        scoreType: 'min',
        value: null,
        status: 'withdrawn',
      }

      const keyScored = computeSortKey(scored)
      const keyCapped = computeSortKey(capped)
      const keyDq = computeSortKey(dq)
      const keyWithdrawn = computeSortKey(withdrawn)

      // Status order: scored < cap < dq < withdrawn
      expect(keyScored).toBeLessThan(keyCapped)
      expect(keyCapped).toBeLessThan(keyDq)
      expect(keyDq).toBeLessThan(keyWithdrawn)
    })
  })

  describe('Higher is better schemes (reps, load)', () => {
    it('should sort reps correctly (higher is better)', () => {
      const scores: Score[] = [
        {scheme: 'reps', scoreType: 'max', value: 100, status: 'scored'},
        {scheme: 'reps', scoreType: 'max', value: 150, status: 'scored'},
        {scheme: 'reps', scoreType: 'max', value: 125, status: 'scored'},
      ]

      const sorted = sortScores([...scores])

      expect(sorted[0]?.value).toBe(150) // Most reps first
      expect(sorted[1]?.value).toBe(125)
      expect(sorted[2]?.value).toBe(100)
    })

    it('should sort load correctly (higher is better)', () => {
      const scores: Score[] = [
        {scheme: 'load', scoreType: 'max', value: 100000, status: 'scored'}, // ~220 lbs
        {scheme: 'load', scoreType: 'max', value: 150000, status: 'scored'}, // ~330 lbs
        {scheme: 'load', scoreType: 'max', value: 125000, status: 'scored'}, // ~275 lbs
      ]

      const sorted = sortScores([...scores])

      expect(sorted[0]?.value).toBe(150000) // Heaviest first
      expect(sorted[1]?.value).toBe(125000)
      expect(sorted[2]?.value).toBe(100000)
    })

    it('should sort rounds-reps correctly (higher is better)', () => {
      const scores: Score[] = [
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 500010,
          status: 'scored',
        }, // 5+10
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 600005,
          status: 'scored',
        }, // 6+5
        {
          scheme: 'rounds-reps',
          scoreType: 'max',
          value: 500020,
          status: 'scored',
        }, // 5+20
      ]

      const sorted = sortScores([...scores])

      expect(sorted[0]?.value).toBe(600005) // 6+5 is best
      expect(sorted[1]?.value).toBe(500020) // 5+20 is second
      expect(sorted[2]?.value).toBe(500010) // 5+10 is worst
    })
  })
})

describe('Millisecond precision in time caps and tiebreaks', () => {
  it('should handle millisecond precision in tiebreaks', () => {
    const scores: Score[] = [
      {
        scheme: 'rounds-reps',
        scoreType: 'max',
        value: 500012,
        status: 'scored',
        tiebreak: {scheme: 'time', value: 510500}, // 8:30.500
      },
      {
        scheme: 'rounds-reps',
        scoreType: 'max',
        value: 500012,
        status: 'scored',
        tiebreak: {scheme: 'time', value: 510250}, // 8:30.250
      },
      {
        scheme: 'rounds-reps',
        scoreType: 'max',
        value: 500012,
        status: 'scored',
        tiebreak: {scheme: 'time', value: 510750}, // 8:30.750
      },
    ]

    const sorted = sortScores([...scores])

    // Milliseconds matter for tiebreak
    expect(sorted[0]?.tiebreak?.value).toBe(510250) // Fastest
    expect(sorted[1]?.tiebreak?.value).toBe(510500)
    expect(sorted[2]?.tiebreak?.value).toBe(510750) // Slowest
  })

  it('should format millisecond tiebreaks correctly', () => {
    const score: Score = {
      scheme: 'rounds-reps',
      scoreType: 'max',
      value: 500012,
      status: 'scored',
      tiebreak: {scheme: 'time', value: 510567}, // 8:30.567
    }

    const formatted = formatScoreWithTiebreak(score)
    expect(formatted).toBe('05+12 (TB: 8:30.567)')
  })
})
