import { Schema } from "effect"

// --- Competition ---

const OrganizingTeamSchema = Schema.Struct({
  name: Schema.String,
  slug: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
})

const AddressSchema = Schema.Struct({
  name: Schema.NullOr(Schema.String),
  streetLine1: Schema.NullOr(Schema.String),
  streetLine2: Schema.NullOr(Schema.String),
  city: Schema.NullOr(Schema.String),
  stateProvince: Schema.NullOr(Schema.String),
  postalCode: Schema.NullOr(Schema.String),
  countryCode: Schema.NullOr(Schema.String),
})

export const CompetitionSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  startDate: Schema.String,
  endDate: Schema.String,
  timezone: Schema.NullOr(Schema.String),
  status: Schema.String,
  competitionType: Schema.NullOr(Schema.String),
  profileImageUrl: Schema.NullOr(Schema.String),
  bannerImageUrl: Schema.NullOr(Schema.String),
  organizingTeam: Schema.NullOr(OrganizingTeamSchema),
  address: Schema.NullOr(AddressSchema),
})

export type Competition = typeof CompetitionSchema.Type

export const CompetitionResponseSchema = Schema.Struct({
  competition: CompetitionSchema,
})

// --- Heats ---

const VenueSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
})

const DivisionSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
})

const HeatSchema = Schema.Struct({
  id: Schema.String,
  heatNumber: Schema.Number,
  scheduledTime: Schema.NullOr(Schema.String),
  durationMinutes: Schema.NullOr(Schema.Number),
  venue: Schema.NullOr(VenueSchema),
  division: Schema.NullOr(DivisionSchema),
})

const EventHeatsSchema = Schema.Struct({
  trackWorkoutId: Schema.String,
  eventName: Schema.String,
  trackOrder: Schema.Number,
  heats: Schema.Array(HeatSchema),
})

export const HeatsResponseSchema = Schema.Struct({
  events: Schema.Array(EventHeatsSchema),
})

export type HeatsResponse = typeof HeatsResponseSchema.Type

// --- Workouts ---

const MovementSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
})

const TagSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
})

const WorkoutDetailSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  scheme: Schema.String,
  scoreType: Schema.NullOr(Schema.String),
  roundsToScore: Schema.NullOr(Schema.Number),
  repsPerRound: Schema.NullOr(Schema.Number),
  tiebreakScheme: Schema.NullOr(Schema.String),
  timeCap: Schema.NullOr(Schema.Number),
  movements: Schema.Array(MovementSchema),
  tags: Schema.Array(TagSchema),
})

const TrackWorkoutSchema = Schema.Struct({
  id: Schema.String,
  trackId: Schema.String,
  workoutId: Schema.String,
  trackOrder: Schema.Number,
  notes: Schema.NullOr(Schema.String),
  eventStatus: Schema.String,
  workout: WorkoutDetailSchema,
})

export const WorkoutsResponseSchema = Schema.Struct({
  workouts: Schema.Array(TrackWorkoutSchema),
})

export type WorkoutsResponse = typeof WorkoutsResponseSchema.Type

// --- Registrations ---

export const RegistrationSchema = Schema.Struct({
  id: Schema.String,
  eventId: Schema.String,
  userId: Schema.String,
  divisionId: Schema.NullOr(Schema.String),
  registeredAt: Schema.String,
  status: Schema.String,
  teamName: Schema.NullOr(Schema.String),
  captainUserId: Schema.NullOr(Schema.String),
})

export type Registration = typeof RegistrationSchema.Type

export const RegistrationsResponseSchema = Schema.Struct({
  registrations: Schema.Array(RegistrationSchema),
})

// --- Scores ---

export const WindowStatusSchema = Schema.Struct({
  isOpen: Schema.Boolean,
  opensAt: Schema.NullOr(Schema.String),
  closesAt: Schema.NullOr(Schema.String),
})

export type WindowStatus = typeof WindowStatusSchema.Type

export const ScoreSubmitResponseSchema = Schema.Struct({
  success: Schema.Boolean,
  scoreId: Schema.String,
  message: Schema.String,
})

export type ScoreSubmitResponse = typeof ScoreSubmitResponseSchema.Type

export const VideoSubmitResponseSchema = Schema.Struct({
  success: Schema.Boolean,
  submissionId: Schema.String,
  isUpdate: Schema.Boolean,
})

export type VideoSubmitResponse = typeof VideoSubmitResponseSchema.Type
