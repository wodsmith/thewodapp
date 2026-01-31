import {fireEvent, render, screen} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {SchedulePageContent} from '@/components/schedule-page-content'
import type {HeatWithAssignments} from '@/server-fns/competition-heats-fns'
import type {CompetitionWorkout} from '@/server-fns/competition-workouts-fns'

// Helper factories for test data
function createMockEvent(
  overrides: Partial<CompetitionWorkout> = {},
): CompetitionWorkout {
  return {
    id: 'tw-1',
    trackId: 'track-1',
    workoutId: 'workout-1',
    trackOrder: 1,
    notes: null,
    pointsMultiplier: 100,
    heatStatus: 'published',
    eventStatus: 'published',
    sponsorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    workout: {
      id: 'workout-1',
      name: 'Event 1',
      description: 'Test workout',
      scheme: 'time',
      scoreType: 'min',
      roundsToScore: null,
      repsPerRound: null,
      tiebreakScheme: null,
      timeCap: null,
    },
    ...overrides,
  }
}

function createMockHeat(
  overrides: Partial<HeatWithAssignments> = {},
): HeatWithAssignments {
  return {
    id: 'heat-1',
    competitionId: 'comp-1',
    trackWorkoutId: 'tw-1',
    heatNumber: 1,
    scheduledTime: new Date('2025-01-15T09:00:00'),
    durationMinutes: 10,
    venueId: null,
    divisionId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: null,
    schedulePublishedAt: null,
    venue: null,
    division: null,
    assignments: [],
    ...overrides,
  }
}

function createMockAssignment(
  overrides: Partial<HeatWithAssignments['assignments'][0]> = {},
): HeatWithAssignments['assignments'][0] {
  return {
    id: 'assignment-1',
    laneNumber: 1,
    registration: {
      id: 'reg-1',
      teamName: null,
      user: {id: 'user-1', firstName: 'John', lastName: 'Doe'},
      division: {id: 'div-1', label: 'RX'},
      affiliate: 'CrossFit Box',
    },
    ...overrides,
  }
}

describe('SchedulePageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Empty State', () => {
    it('shows empty state when no heats exist', () => {
      render(
        <SchedulePageContent
          events={[]}
          heats={[]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      expect(screen.getByText('Schedule')).toBeInTheDocument()
      expect(screen.getByText('Schedule Coming Soon')).toBeInTheDocument()
      expect(
        screen.getByText(
          "The heat schedule for this competition hasn't been published yet.",
        ),
      ).toBeInTheDocument()
    })
  })

  describe('Schedule Display', () => {
    it('renders schedule with heats grouped by day', () => {
      const event1 = createMockEvent({
        id: 'tw-1',
        trackOrder: 1,
        workout: {
          id: 'w-1',
          name: 'Morning Event',
          description: null,
          scheme: 'time',
          scoreType: 'min',
          roundsToScore: null,
          repsPerRound: null,
          tiebreakScheme: null,
          timeCap: null,
        },
      })

      const heat1 = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: new Date('2025-01-15T09:00:00'),
      })

      render(
        <SchedulePageContent
          events={[event1]}
          heats={[heat1]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      expect(screen.getByText('Schedule')).toBeInTheDocument()
      expect(screen.getByText('Morning Event')).toBeInTheDocument()
      expect(screen.getByText('1 heat')).toBeInTheDocument()
    })

    it('displays heat information with time and venue', () => {
      const event = createMockEvent({id: 'tw-1', trackOrder: 1})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: new Date('2025-01-15T14:30:00'),
        venue: {
          id: 'venue-1',
          competitionId: 'comp-1',
          name: 'Main Floor',
          laneCount: 8,
          transitionMinutes: 3,
          sortOrder: 0,
          addressId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updateCounter: null,
        },
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      const workoutButton = screen.getByRole('button', {name: /Event 1/i})
      fireEvent.click(workoutButton)

      expect(screen.getByText('Heat 1')).toBeInTheDocument()
      expect(screen.getByText('Main Floor')).toBeInTheDocument()
    })

    it('shows lane assignments with athlete names when expanded', () => {
      const event = createMockEvent({
        id: 'tw-1',
        trackOrder: 1,
        heatStatus: 'published',
      })
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        assignments: [
          createMockAssignment({
            id: 'a-1',
            laneNumber: 1,
            registration: {
              id: 'reg-1',
              teamName: null,
              user: {id: 'user-1', firstName: 'John', lastName: 'Doe'},
              division: {id: 'div-1', label: 'RX'},
              affiliate: 'CrossFit Box 1',
            },
          }),
          createMockAssignment({
            id: 'a-2',
            laneNumber: 2,
            registration: {
              id: 'reg-2',
              teamName: 'Team Alpha',
              user: {id: 'user-2', firstName: 'Jane', lastName: 'Smith'},
              division: {id: 'div-2', label: 'Scaled'},
              affiliate: null,
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      const workoutButton = screen.getByRole('button', {name: /Event 1/i})
      fireEvent.click(workoutButton)

      const heatButton = screen.getByRole('button', {name: /Heat 1/i})
      fireEvent.click(heatButton)

      // Use getAllByText since there's mobile + desktop views
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Team Alpha').length).toBeGreaterThan(0)
      expect(screen.getAllByText('CrossFit Box 1').length).toBeGreaterThan(0)
      expect(screen.getAllByText('RX').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Scaled').length).toBeGreaterThan(0)
    })

    it('shows "Assignments coming soon" badge when heat status is draft', () => {
      const event = createMockEvent({
        id: 'tw-1',
        trackOrder: 1,
        heatStatus: 'draft',
      })
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        assignments: [],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      const workoutButton = screen.getByRole('button', {name: /Event 1/i})
      fireEvent.click(workoutButton)

      expect(screen.getByText('Coming soon')).toBeInTheDocument()
    })
  })

  describe('Search/Filter Functionality', () => {
    it('filters by competitor name', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        assignments: [
          createMockAssignment({
            registration: {
              id: 'reg-1',
              teamName: null,
              user: {id: 'user-1', firstName: 'John', lastName: 'Doe'},
              division: {id: 'div-1', label: 'RX'},
              affiliate: 'CrossFit Box',
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      const searchInput = screen.getByPlaceholderText(
        /search competitor, division, or affiliate/i,
      )
      fireEvent.change(searchInput, {target: {value: 'John'}})

      expect(
        screen.getByText(/found matches in 1 workout/i),
      ).toBeInTheDocument()
    })

    it('shows no matches message when search yields no results', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        assignments: [
          createMockAssignment({
            registration: {
              id: 'reg-1',
              teamName: null,
              user: {id: 'user-1', firstName: 'John', lastName: 'Doe'},
              division: {id: 'div-1', label: 'RX'},
              affiliate: 'CrossFit Box',
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      const searchInput = screen.getByPlaceholderText(
        /search competitor, division, or affiliate/i,
      )
      fireEvent.change(searchInput, {target: {value: 'nonexistent'}})

      expect(
        screen.getByText(/no matches found for "nonexistent"/i),
      ).toBeInTheDocument()
    })

    it('auto-expands workouts and heats when searching', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        assignments: [
          createMockAssignment({
            registration: {
              id: 'reg-1',
              teamName: null,
              user: {
                id: 'user-1',
                firstName: 'SearchableAthlete',
                lastName: 'Name',
              },
              division: null,
              affiliate: null,
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      const searchInput = screen.getByPlaceholderText(
        /search competitor, division, or affiliate/i,
      )
      fireEvent.change(searchInput, {target: {value: 'SearchableAthlete'}})

      // After searching, the athlete name should be visible (auto-expanded)
      expect(
        screen.getAllByText('SearchableAthlete Name').length,
      ).toBeGreaterThan(0)
    })
  })

  describe('My Heats Section', () => {
    it('shows "My Heats" section when current user has heats', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        assignments: [
          createMockAssignment({
            laneNumber: 3,
            registration: {
              id: 'reg-1',
              teamName: null,
              user: {
                id: 'current-user',
                firstName: 'Current',
                lastName: 'User',
              },
              division: {id: 'div-1', label: 'RX'},
              affiliate: null,
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId="current-user"
          timezone="America/Denver"
        />,
      )

      expect(screen.getByText('My Heats')).toBeInTheDocument()
      expect(screen.getByText(/Heat 1/)).toBeInTheDocument()
      expect(screen.getByText(/Lane 3/)).toBeInTheDocument()
    })

    it('does not show "My Heats" section when user is not in any heats', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        assignments: [
          createMockAssignment({
            registration: {
              id: 'reg-1',
              teamName: null,
              user: {id: 'other-user', firstName: 'Other', lastName: 'Person'},
              division: null,
              affiliate: null,
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId="current-user"
          timezone="America/Denver"
        />,
      )

      expect(screen.queryByText('My Heats')).not.toBeInTheDocument()
    })

    it('shows "You\'re here" badge in heat listing for current user', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        assignments: [
          createMockAssignment({
            registration: {
              id: 'reg-1',
              teamName: null,
              user: {
                id: 'current-user',
                firstName: 'Current',
                lastName: 'User',
              },
              division: null,
              affiliate: null,
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId="current-user"
          timezone="America/Denver"
        />,
      )

      const workoutButton = screen.getByRole('button', {name: /Event 1/i})
      fireEvent.click(workoutButton)

      expect(screen.getByText("You're here")).toBeInTheDocument()
    })
  })

  describe('Day Tabs', () => {
    it('shows day tabs when heats span multiple days', () => {
      const event1 = createMockEvent({id: 'tw-1', trackOrder: 1})
      const event2 = createMockEvent({
        id: 'tw-2',
        trackOrder: 2,
        workoutId: 'workout-2',
        workout: {
          id: 'workout-2',
          name: 'Event 2',
          description: null,
          scheme: 'time',
          scoreType: 'min',
          roundsToScore: null,
          repsPerRound: null,
          tiebreakScheme: null,
          timeCap: null,
        },
      })

      const heat1 = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        scheduledTime: new Date('2025-01-15T09:00:00'),
      })
      const heat2 = createMockHeat({
        id: 'heat-2',
        trackWorkoutId: 'tw-2',
        scheduledTime: new Date('2025-01-16T09:00:00'),
      })

      render(
        <SchedulePageContent
          events={[event1, event2]}
          heats={[heat1, heat2]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      expect(screen.getByRole('button', {name: 'All Days'})).toBeInTheDocument()
    })

    it('does not show day tabs when all heats are on same day', () => {
      const event = createMockEvent({id: 'tw-1'})
      const heat1 = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: new Date('2025-01-15T09:00:00'),
      })
      const heat2 = createMockHeat({
        id: 'heat-2',
        trackWorkoutId: 'tw-1',
        heatNumber: 2,
        scheduledTime: new Date('2025-01-15T10:00:00'),
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat1, heat2]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      expect(
        screen.queryByRole('button', {name: 'All Days'}),
      ).not.toBeInTheDocument()
    })
  })

  describe('Heat Expansion', () => {
    it('expands and collapses workout when clicked', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      expect(screen.queryByText('Heat 1')).not.toBeInTheDocument()

      const workoutButton = screen.getByRole('button', {name: /Event 1/i})
      fireEvent.click(workoutButton)

      expect(screen.getByText('Heat 1')).toBeInTheDocument()

      fireEvent.click(workoutButton)

      expect(screen.queryByText('Heat 1')).not.toBeInTheDocument()
    })

    it('collapses all child heats when workout is collapsed', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        assignments: [
          createMockAssignment({
            registration: {
              id: 'reg-1',
              teamName: null,
              user: {id: 'user-1', firstName: 'Test', lastName: 'Athlete'},
              division: null,
              affiliate: null,
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      const workoutButton = screen.getByRole('button', {name: /Event 1/i})
      fireEvent.click(workoutButton)

      const heatButton = screen.getByRole('button', {name: /Heat 1/i})
      fireEvent.click(heatButton)

      expect(screen.getAllByText('Test Athlete').length).toBeGreaterThan(0)

      fireEvent.click(workoutButton)

      expect(screen.queryByText('Test Athlete')).not.toBeInTheDocument()
    })
  })

  describe('Team Display', () => {
    it('shows team name instead of athlete name for team registrations', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        assignments: [
          createMockAssignment({
            registration: {
              id: 'reg-1',
              teamName: 'Team Champions',
              user: {id: 'user-1', firstName: 'Captain', lastName: 'Person'},
              division: null,
              affiliate: null,
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      const workoutButton = screen.getByRole('button', {name: /Event 1/i})
      fireEvent.click(workoutButton)
      const heatButton = screen.getByRole('button', {name: /Heat 1/i})
      fireEvent.click(heatButton)

      expect(screen.getAllByText('Team Champions').length).toBeGreaterThan(0)
      expect(screen.queryByText('Captain Person')).not.toBeInTheDocument()
    })
  })

  describe('Division Breakdown', () => {
    it('shows division summary badge on heat', () => {
      const event = createMockEvent({id: 'tw-1', heatStatus: 'published'})
      const heat = createMockHeat({
        id: 'heat-1',
        trackWorkoutId: 'tw-1',
        assignments: [
          createMockAssignment({
            id: 'a-1',
            laneNumber: 1,
            registration: {
              id: 'reg-1',
              teamName: null,
              user: {id: 'user-1', firstName: 'Test1', lastName: 'Athlete1'},
              division: {id: 'div-1', label: 'RX'},
              affiliate: null,
            },
          }),
          createMockAssignment({
            id: 'a-2',
            laneNumber: 2,
            registration: {
              id: 'reg-2',
              teamName: null,
              user: {id: 'user-2', firstName: 'Test2', lastName: 'Athlete2'},
              division: {id: 'div-1', label: 'RX'},
              affiliate: null,
            },
          }),
        ],
      })

      render(
        <SchedulePageContent
          events={[event]}
          heats={[heat]}
          currentUserId={undefined}
          timezone="America/Denver"
        />,
      )

      const workoutButton = screen.getByRole('button', {name: /Event 1/i})
      fireEvent.click(workoutButton)

      expect(screen.getByText('RX')).toBeInTheDocument()
    })
  })
})
