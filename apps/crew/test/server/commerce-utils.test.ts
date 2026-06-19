import {describe, expect, it} from 'vitest'
import {
  PLATFORM_DEFAULTS,
  FOUNDING_ORGANIZER_DEFAULTS,
  buildFeeConfig,
  getTeamPlatformFee,
  calculateCompetitionFees,
  formatCents,
  type TeamFeeOverrides,
} from '@/server/commerce/utils'

describe('Commerce Utils', () => {
  describe('PLATFORM_DEFAULTS', () => {
    it('should have 4% platform fee (400 basis points)', () => {
      expect(PLATFORM_DEFAULTS.platformPercentageBasisPoints).toBe(400)
    })

    it('should have $2.00 fixed platform fee (200 cents)', () => {
      expect(PLATFORM_DEFAULTS.platformFixedCents).toBe(200)
    })

    it('should have 2.9% Stripe fee (290 basis points)', () => {
      expect(PLATFORM_DEFAULTS.stripePercentageBasisPoints).toBe(290)
    })

    it('should have $0.30 fixed Stripe fee (30 cents)', () => {
      expect(PLATFORM_DEFAULTS.stripeFixedCents).toBe(30)
    })
  })

  describe('FOUNDING_ORGANIZER_DEFAULTS', () => {
    it('should have 2.5% platform fee (250 basis points)', () => {
      expect(FOUNDING_ORGANIZER_DEFAULTS.platformPercentageBasisPoints).toBe(
        250,
      )
    })

    it('should have $2.00 fixed platform fee (200 cents)', () => {
      expect(FOUNDING_ORGANIZER_DEFAULTS.platformFixedCents).toBe(200)
    })
  })

  describe('buildFeeConfig', () => {
    describe('with no overrides', () => {
      it('should use platform defaults when competition and team have no overrides', () => {
        const config = buildFeeConfig({})

        expect(config.platformPercentageBasisPoints).toBe(400)
        expect(config.platformFixedCents).toBe(200)
        expect(config.stripePercentageBasisPoints).toBe(290)
        expect(config.stripeFixedCents).toBe(30)
      })

      it('should default passPlatformFeesToCustomer to true', () => {
        const config = buildFeeConfig({})
        expect(config.passPlatformFeesToCustomer).toBe(true)
      })

      it('should default passStripeFeesToCustomer to false', () => {
        const config = buildFeeConfig({})
        expect(config.passStripeFeesToCustomer).toBe(false)
      })
    })

    describe('with team overrides (founding organizer)', () => {
      const foundingOrganizerTeam: TeamFeeOverrides = {
        organizerFeePercentage: 250,
        organizerFeeFixed: 200,
      }

      it('should use team overrides when competition has no overrides', () => {
        const config = buildFeeConfig({}, foundingOrganizerTeam)

        expect(config.platformPercentageBasisPoints).toBe(250)
        expect(config.platformFixedCents).toBe(200)
      })

      it('should still use platform defaults for Stripe fees', () => {
        const config = buildFeeConfig({}, foundingOrganizerTeam)

        expect(config.stripePercentageBasisPoints).toBe(290)
        expect(config.stripeFixedCents).toBe(30)
      })
    })

    describe('with competition overrides', () => {
      it('should use competition overrides over team and platform defaults', () => {
        const competition = {
          platformFeePercentage: 300,
          platformFeeFixed: 150,
        }
        const team: TeamFeeOverrides = {
          organizerFeePercentage: 250,
          organizerFeeFixed: 200,
        }

        const config = buildFeeConfig(competition, team)

        expect(config.platformPercentageBasisPoints).toBe(300)
        expect(config.platformFixedCents).toBe(150)
      })

      it('should use competition boolean flags', () => {
        const competition = {
          passStripeFeesToCustomer: true,
          passPlatformFeesToCustomer: false,
        }

        const config = buildFeeConfig(competition)

        expect(config.passStripeFeesToCustomer).toBe(true)
        expect(config.passPlatformFeesToCustomer).toBe(false)
      })
    })

    describe('priority order: competition > team > platform', () => {
      it('should prefer competition over team when both set', () => {
        const competition = {platformFeePercentage: 100}
        const team: TeamFeeOverrides = {organizerFeePercentage: 200}

        const config = buildFeeConfig(competition, team)
        expect(config.platformPercentageBasisPoints).toBe(100)
      })

      it('should fall back to team when competition is null', () => {
        const competition = {platformFeePercentage: null}
        const team: TeamFeeOverrides = {organizerFeePercentage: 200}

        const config = buildFeeConfig(competition, team)
        expect(config.platformPercentageBasisPoints).toBe(200)
      })

      it('should fall back to platform when both are null', () => {
        const competition = {platformFeePercentage: null}
        const team: TeamFeeOverrides = {organizerFeePercentage: null}

        const config = buildFeeConfig(competition, team)
        expect(config.platformPercentageBasisPoints).toBe(400)
      })

      it('should handle partial team overrides', () => {
        const competition = {}
        const team: TeamFeeOverrides = {
          organizerFeePercentage: 250,
          // organizerFeeFixed is undefined
        }

        const config = buildFeeConfig(competition, team)
        expect(config.platformPercentageBasisPoints).toBe(250)
        expect(config.platformFixedCents).toBe(200) // platform default
      })
    })
  })

  describe('getTeamPlatformFee', () => {
    it('should return platform defaults when no team provided', () => {
      const fee = getTeamPlatformFee()

      expect(fee.percentageBasisPoints).toBe(400)
      expect(fee.fixedCents).toBe(200)
    })

    it('should return platform defaults when team has no overrides', () => {
      const fee = getTeamPlatformFee({})

      expect(fee.percentageBasisPoints).toBe(400)
      expect(fee.fixedCents).toBe(200)
    })

    it('should return team overrides when set', () => {
      const team: TeamFeeOverrides = {
        organizerFeePercentage: 250,
        organizerFeeFixed: 200,
      }

      const fee = getTeamPlatformFee(team)

      expect(fee.percentageBasisPoints).toBe(250)
      expect(fee.fixedCents).toBe(200)
    })

    it('should handle partial overrides', () => {
      const team: TeamFeeOverrides = {
        organizerFeePercentage: 250,
        // organizerFeeFixed is undefined
      }

      const fee = getTeamPlatformFee(team)

      expect(fee.percentageBasisPoints).toBe(250)
      expect(fee.fixedCents).toBe(200) // platform default
    })

    it('should handle null values as no override', () => {
      const team: TeamFeeOverrides = {
        organizerFeePercentage: null,
        organizerFeeFixed: null,
      }

      const fee = getTeamPlatformFee(team)

      expect(fee.percentageBasisPoints).toBe(400)
      expect(fee.fixedCents).toBe(200)
    })
  })

  describe('calculateCompetitionFees with new defaults', () => {
    it('should calculate correct platform fee with 4% + $2 default', () => {
      const config = buildFeeConfig({})
      const breakdown = calculateCompetitionFees(5000, config) // $50 registration

      // Platform fee: $50 * 4% + $2 = $2 + $2 = $4
      expect(breakdown.platformFeeCents).toBe(400)
    })

    it('should calculate correct platform fee with founding organizer rate', () => {
      const team: TeamFeeOverrides = {
        organizerFeePercentage: 250,
        organizerFeeFixed: 200,
      }
      const config = buildFeeConfig({}, team)
      const breakdown = calculateCompetitionFees(5000, config) // $50 registration

      // Platform fee: $50 * 2.5% + $2 = $1.25 + $2 = $3.25
      expect(breakdown.platformFeeCents).toBe(325)
    })

    it('should show difference between standard and founding rates (percentage only)', () => {
      const standardConfig = buildFeeConfig({})
      const foundingConfig = buildFeeConfig(
        {},
        {organizerFeePercentage: 250, organizerFeeFixed: 200},
      )

      const standardBreakdown = calculateCompetitionFees(10000, standardConfig) // $100 registration
      const foundingBreakdown = calculateCompetitionFees(10000, foundingConfig)

      // Standard: $100 * 4% + $2 = $6
      expect(standardBreakdown.platformFeeCents).toBe(600)

      // Founding: $100 * 2.5% + $2 = $4.50
      expect(foundingBreakdown.platformFeeCents).toBe(450)

      // Founding organizers save $1.50 per $100 registration (1.5% difference)
      expect(standardBreakdown.platformFeeCents - foundingBreakdown.platformFeeCents).toBe(150)
    })
  })

  describe('formatCents', () => {
    it('should format 0 cents as $0.00', () => {
      expect(formatCents(0)).toBe('$0.00')
    })

    it('should format 100 cents as $1.00', () => {
      expect(formatCents(100)).toBe('$1.00')
    })

    it('should format 5325 cents as $53.25', () => {
      expect(formatCents(5325)).toBe('$53.25')
    })

    it('should format 400 cents as $4.00', () => {
      expect(formatCents(400)).toBe('$4.00')
    })
  })
})
