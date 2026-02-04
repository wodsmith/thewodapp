/**
 * Demo Competition Data Constants
 * Provides fake names, workout templates, and waiver content for demo competition generation
 */

// ============================================================================
// Name Arrays
// ============================================================================

export const MALE_FIRST_NAMES = [
	"James",
	"John",
	"Michael",
	"David",
	"Chris",
	"Matt",
	"Josh",
	"Ryan",
	"Tyler",
	"Brandon",
	"Andrew",
	"Daniel",
	"Justin",
	"Kevin",
	"Brian",
	"Nick",
	"Eric",
	"Jason",
	"Adam",
	"Mark",
	"Scott",
	"Steven",
	"Jake",
	"Ben",
	"Tom",
]

export const FEMALE_FIRST_NAMES = [
	"Sarah",
	"Emily",
	"Jessica",
	"Ashley",
	"Amanda",
	"Brittany",
	"Samantha",
	"Lauren",
	"Megan",
	"Rachel",
	"Nicole",
	"Stephanie",
	"Jennifer",
	"Heather",
	"Michelle",
	"Katie",
	"Rebecca",
	"Lindsey",
	"Taylor",
	"Courtney",
	"Danielle",
	"Kimberly",
	"Christina",
	"Alexandra",
	"Melissa",
]

export const LAST_NAMES = [
	"Smith",
	"Johnson",
	"Williams",
	"Brown",
	"Jones",
	"Miller",
	"Davis",
	"Garcia",
	"Rodriguez",
	"Wilson",
	"Martinez",
	"Anderson",
	"Taylor",
	"Thomas",
	"Moore",
	"Jackson",
	"Martin",
	"Lee",
	"Thompson",
	"White",
	"Harris",
	"Clark",
	"Lewis",
	"Robinson",
	"Walker",
]

// ============================================================================
// Workout Templates
// ============================================================================

export interface WorkoutTemplate {
	name: string
	description: string
	scheme: "time-with-cap" | "load" | "rounds-reps"
	timeCap?: number // seconds
	tiebreakScheme?: "time" | "reps"
	scoreType: "min" | "max" | "sum"
	repsPerRound?: number
	roundsToScore?: number
	// Gender-specific scaling descriptions
	maleScaling?: string
	femaleScaling?: string
	// Team-specific notes (appended to individual scaling)
	teamNotes?: string
}

export const DEMO_WORKOUTS: WorkoutTemplate[] = [
	{
		name: "Event 1 - The Opener",
		description: `For Time (12 min cap):
21-15-9
Thrusters (95/65 lb)
Pull-ups

*Tiebreak at completion of round of 15*`,
		scheme: "time-with-cap",
		timeCap: 720, // 12 minutes in seconds
		tiebreakScheme: "time",
		scoreType: "min",
		maleScaling: `**Thrusters:** 95 lb
**Pull-ups:** Strict or Kipping`,
		femaleScaling: `**Thrusters:** 65 lb
**Pull-ups:** Strict or Kipping`,
		teamNotes: `Partners alternate full rounds (one athlete completes 21-21, then switch)`,
	},
	{
		name: "Event 2 - The Ladder",
		description: `Clean Ladder:
5 attempts to establish max complex:
1 Squat Clean + 1 Hang Clean + 1 Jerk

*Score is total load lifted across all successful attempts*`,
		scheme: "load",
		scoreType: "sum",
		roundsToScore: 5,
		maleScaling: `**Starting Weight:** 135 lb
**Max Weight:** 315 lb
**Increment:** Athlete's choice (plates available: 2.5, 5, 10, 15, 25, 35, 45 lb)`,
		femaleScaling: `**Starting Weight:** 95 lb
**Max Weight:** 225 lb
**Increment:** Athlete's choice (plates available: 2.5, 5, 10, 15, 25, 35, 45 lb)`,
		teamNotes: `Each partner gets 5 attempts. Team score is combined total.`,
	},
	{
		name: "Event 3 - The Chipper",
		description: `AMRAP 15:
30 Double-unders
20 Wall Balls (20/14 lb)
10 Toes-to-bar

*Tiebreak at completion of round 2*`,
		scheme: "rounds-reps",
		timeCap: 900, // 15 minutes
		tiebreakScheme: "time",
		scoreType: "max",
		repsPerRound: 60, // 30+20+10
		maleScaling: `**Double-unders:** 30 reps
**Wall Balls:** 20 lb to 10' target, 20 reps
**Toes-to-bar:** 10 reps`,
		femaleScaling: `**Double-unders:** 30 reps
**Wall Balls:** 14 lb to 9' target, 20 reps
**Toes-to-bar:** 10 reps`,
		teamNotes: `Partners share reps as needed. Both must complete at least 1 rep of each movement per round.`,
	},
]

// ============================================================================
// Division Configuration
// ============================================================================

export interface DivisionConfig {
	label: string
	position: number
	teamSize: number
	feeCents: number
	gender: "male" | "female"
}

export const DEMO_DIVISIONS: DivisionConfig[] = [
	{
		label: "Rx Male Individual",
		position: 0,
		teamSize: 1,
		feeCents: 15000, // $150
		gender: "male",
	},
	{
		label: "Rx Male Team of 2",
		position: 1,
		teamSize: 2,
		feeCents: 20000, // $200
		gender: "male",
	},
	{
		label: "Rx Female Individual",
		position: 2,
		teamSize: 1,
		feeCents: 15000, // $150
		gender: "female",
	},
	{
		label: "Rx Female Team of 2",
		position: 3,
		teamSize: 2,
		feeCents: 20000, // $200
		gender: "female",
	},
]

// ============================================================================
// Primary Address
// ============================================================================

export const DEMO_PRIMARY_ADDRESS = {
	name: "CrossFit Demo Gym",
	streetLine1: "123 Barbell Way",
	streetLine2: "Suite 100",
	city: "Austin",
	stateProvince: "TX",
	postalCode: "78701",
	countryCode: "US",
	addressType: "venue" as const,
}

// ============================================================================
// Sponsor Templates
// ============================================================================

export interface SponsorTemplate {
	name: string
	website: string
}

export const DEMO_SPONSORS: SponsorTemplate[] = [
	{
		name: "CrossFit Equipment Co",
		website: "https://example.com/crossfit-equipment",
	},
	{
		name: "Performance Nutrition",
		website: "https://example.com/performance-nutrition",
	},
	{
		name: "Athletic Apparel Brand",
		website: "https://example.com/athletic-apparel",
	},
]

// ============================================================================
// Waiver Content (Lexical JSON)
// ============================================================================

/**
 * Simple Lexical JSON structure for demo liability waiver
 */
export const DEMO_WAIVER_CONTENT = JSON.stringify({
	root: {
		children: [
			{
				children: [
					{
						detail: 0,
						format: 1, // bold
						mode: "normal",
						style: "",
						text: "Liability Waiver and Release",
						type: "text",
						version: 1,
					},
				],
				direction: "ltr",
				format: "",
				indent: 0,
				type: "heading",
				version: 1,
				tag: "h1",
			},
			{
				children: [
					{
						detail: 0,
						format: 0,
						mode: "normal",
						style: "",
						text: "By signing this waiver, I acknowledge that I am participating in a competitive fitness event. I understand that participating in such activities carries inherent risks, including but not limited to physical injury, emotional distress, or death.",
						type: "text",
						version: 1,
					},
				],
				direction: "ltr",
				format: "",
				indent: 0,
				type: "paragraph",
				version: 1,
			},
			{
				children: [
					{
						detail: 0,
						format: 0,
						mode: "normal",
						style: "",
						text: "I hereby release and hold harmless the competition organizers, venue owners, sponsors, volunteers, and all affiliated parties from any and all liability, claims, demands, actions, or causes of action arising out of or related to my participation in this event.",
						type: "text",
						version: 1,
					},
				],
				direction: "ltr",
				format: "",
				indent: 0,
				type: "paragraph",
				version: 1,
			},
			{
				children: [
					{
						detail: 0,
						format: 0,
						mode: "normal",
						style: "",
						text: "I confirm that I am physically fit and have no medical conditions that would prevent me from safely participating. I agree to follow all rules and instructions provided by event staff.",
						type: "text",
						version: 1,
					},
				],
				direction: "ltr",
				format: "",
				indent: 0,
				type: "paragraph",
				version: 1,
			},
			{
				children: [
					{
						detail: 0,
						format: 2, // italic
						mode: "normal",
						style: "",
						text: "This waiver is for demonstration purposes only.",
						type: "text",
						version: 1,
					},
				],
				direction: "ltr",
				format: "",
				indent: 0,
				type: "paragraph",
				version: 1,
			},
		],
		direction: "ltr",
		format: "",
		indent: 0,
		type: "root",
		version: 1,
	},
})

// ============================================================================
// Demo Email Domain
// ============================================================================

export const DEMO_EMAIL_DOMAIN = "demo.wodsmith.com"

/**
 * Generate a demo email address
 */
export function generateDemoEmail(
	firstName: string,
	lastName: string,
	uniqueId: string,
): string {
	return `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${uniqueId}@${DEMO_EMAIL_DOMAIN}`
}

// ============================================================================
// Score Generation Utilities
// ============================================================================

/**
 * Generate a random time score in milliseconds for time-with-cap workouts
 * @param timeCapMs The time cap in milliseconds
 * @param finishedProbability Probability (0-1) that athlete finished under cap
 * @returns Object with scoreValue, status, and optional secondaryValue (reps if capped)
 */
export function generateTimeScore(
	timeCapMs: number,
	finishedProbability = 0.7,
): {
	scoreValue: number
	status: "scored" | "cap"
	secondaryValue?: number
} {
	const finished = Math.random() < finishedProbability

	if (finished) {
		// Finished under cap - score is time in ms
		// Generate time between 40% and 95% of time cap
		const minTime = timeCapMs * 0.4
		const maxTime = timeCapMs * 0.95
		const scoreValue = Math.floor(minTime + Math.random() * (maxTime - minTime))
		return { scoreValue, status: "scored" }
	}
	// Capped - score is the time cap (they used all the time)
	// secondaryValue is reps completed (out of 45 for 21-15-9)
	const repsCompleted = Math.floor(Math.random() * 45) + 1
	return {
		scoreValue: timeCapMs, // Score is the time cap
		status: "cap",
		secondaryValue: repsCompleted, // Reps they actually completed
	}
}

/**
 * Generate a random load score in grams for load workouts
 * @param gender "male" or "female" for appropriate ranges
 * @param rounds Number of rounds/attempts
 * @returns Object with scoreValue (total grams) and rounds array
 */
export function generateLoadScore(
	gender: "male" | "female",
	rounds: number,
): {
	scoreValue: number
	rounds: number[]
} {
	// Weight ranges in kg (will convert to grams)
	const minKg = gender === "male" ? 100 : 60
	const maxKg = gender === "male" ? 170 : 110

	const roundScores: number[] = []
	let totalGrams = 0

	for (let i = 0; i < rounds; i++) {
		// Each round is a lift - generate weight in kg
		const weightKg = Math.floor(minKg + Math.random() * (maxKg - minKg))
		const weightGrams = weightKg * 1000
		roundScores.push(weightGrams)
		totalGrams += weightGrams
	}

	return {
		scoreValue: totalGrams,
		rounds: roundScores,
	}
}

/**
 * Generate a random rounds+reps score
 * @param repsPerRound Total reps in one round
 * @param timeCap Time cap in seconds (for realistic round counts)
 * @returns Object with scoreValue (encoded as rounds*100000+reps)
 */
export function generateRoundsRepsScore(
	repsPerRound: number,
	_timeCap: number,
): {
	scoreValue: number
	rounds: number
	reps: number
} {
	// Generate between 2-6 complete rounds + partial reps
	const rounds = Math.floor(Math.random() * 5) + 2
	const reps = Math.floor(Math.random() * repsPerRound)

	// Encode as rounds*100000 + reps (standard encoding)
	const scoreValue = rounds * 100000 + reps

	return {
		scoreValue,
		rounds,
		reps,
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const temp = shuffled[i]
		if (temp !== undefined && shuffled[j] !== undefined) {
			shuffled[i] = shuffled[j] as T
			shuffled[j] = temp
		}
	}
	return shuffled
}

/**
 * Pick random items from an array
 */
export function pickRandom<T>(array: T[], count: number): T[] {
	const shuffled = shuffleArray(array)
	return shuffled.slice(0, count)
}

/**
 * Generate a team name from two last names
 */
export function generateTeamName(lastName1: string, lastName2: string): string {
	return `${lastName1} & ${lastName2}`
}
