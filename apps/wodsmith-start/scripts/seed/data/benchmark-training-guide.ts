import { encodeScore } from "../../../src/lib/scoring/encode"
import type { ScoreType, WorkoutScheme } from "../../../src/lib/scoring/types"

export const BENCHMARK_SEED_IDS = {
	batteryId: "bbat_training_guide_v1",
	competitionId: "comp_training_guide_benchmark",
	competitionTeamId: "team_training_guide_benchmark",
	divisionId: "slvl_training_guide_benchmark_open",
	organizingTeamId: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
	organizerMembershipId: "tmem_admin_training_guide_benchmark",
	organizerUserId: "usr_demo1admin",
	scalingGroupId: "sgrp_training_guide_benchmark_open",
	trackId: "track_training_guide_benchmark",
} as const

export const BENCHMARK_SOURCE_RECEIPT = {
	sourceArtifact: {
		path: "/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf",
		sha256:
			"a80c7ab33874ff4fb8a4eea6a044df83511d164e55588a94ec455145a8f3cc38",
		pageCount: 17,
	},
	extractedPageRanges: [
		{ categoryKey: "strength", pages: [8, 9] },
		{ categoryKey: "gymnastics", pages: [10, 11] },
		{ categoryKey: "engine", pages: [12, 13] },
		{ categoryKey: "benchmark_workout", pages: [14, 15] },
		{ categoryKey: "scoresheet_crosswalk", pages: [17] },
	],
	designedTestCount: 58,
	includedTestCount: 55,
	deferredTestCount: 3,
	assumptions: [
		"The PDF is source data only; seeded app-facing names and descriptions stay generic.",
		"Weighted C2B Pull Up is deferred because v1 has no bodyweight-plus-added-load scoring contract.",
		"Open 16.2 and Open 18.4 are deferred because v1 excludes hybrid reps/time scoring.",
		"Deferred tests are seeded as benchmark_tests with includedInScoring=false and no tier threshold rows.",
		"The v1 seed uses videoPolicy \"never\" and isOpenJoin false so athletes use the normal registration flow before submitting scores.",
	],
} as const

export const BENCHMARK_CATEGORIES = [
	{ key: "strength", label: "Strength", testCount: 15, weight: 1 },
	{ key: "gymnastics", label: "Gymnastics", testCount: 13, weight: 1 },
	{ key: "engine", label: "Engine", testCount: 14, weight: 1 },
	{
		key: "benchmark_workout",
		label: "Benchmark Workouts",
		testCount: 13,
		weight: 1,
	},
] as const

export const BENCHMARK_RATING_BANDS = [
	{ key: "elite", label: "Elite", minScore: 90, maxScore: 100 },
	{
		key: "regional_caliber",
		label: "Regional caliber",
		minScore: 75,
		maxScore: 89.999,
	},
	{
		key: "seriously_trained",
		label: "Seriously trained",
		minScore: 60,
		maxScore: 74.999,
	},
	{
		key: "intermediate",
		label: "Intermediate",
		minScore: 45,
		maxScore: 59.999,
	},
	{
		key: "trained_beginner",
		label: "Trained beginner",
		minScore: 30,
		maxScore: 44.999,
	},
	{ key: "early", label: "Early", minScore: 0, maxScore: 29.999 },
] as const

type BenchmarkCategoryKey = (typeof BENCHMARK_CATEGORIES)[number]["key"]
type BenchmarkVariant = "male" | "female"
type BenchmarkScoreModel = "standard" | "hybrid"
type ThresholdTuple = [string, string, string, string, string, string, string, string, string, string]

interface RawBenchmarkTestRow {
	page: number
	categoryKey: BenchmarkCategoryKey
	sourceSection: string
	name: string
	scheme: WorkoutScheme
	scoreType: ScoreType
	inputUnit: string
	includedInScoring: boolean
	scoreModel: BenchmarkScoreModel
	hybridFlipTier: number | null
	deferReason: string | null
	thresholds: Record<BenchmarkVariant, ThresholdTuple>
}

const RAW_BENCHMARK_TESTS = [
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Strict Press",
    "thresholds": {
      "male": [
        "115",
        "130",
        "150",
        "170",
        "185",
        "195",
        "210",
        "220",
        "235",
        "245"
      ],
      "female": [
        "75",
        "90",
        "100",
        "110",
        "125",
        "135",
        "140",
        "150",
        "155",
        "165"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Push Press",
    "thresholds": {
      "male": [
        "165",
        "190",
        "215",
        "240",
        "265",
        "280",
        "295",
        "305",
        "320",
        "335"
      ],
      "female": [
        "115",
        "130",
        "140",
        "150",
        "165",
        "175",
        "185",
        "195",
        "205",
        "215"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Bench Press",
    "thresholds": {
      "male": [
        "225",
        "240",
        "260",
        "280",
        "295",
        "310",
        "325",
        "335",
        "350",
        "365"
      ],
      "female": [
        "125",
        "140",
        "150",
        "160",
        "175",
        "190",
        "205",
        "215",
        "230",
        "245"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Deadlift",
    "thresholds": {
      "male": [
        "275",
        "325",
        "375",
        "425",
        "475",
        "505",
        "530",
        "560",
        "585",
        "615"
      ],
      "female": [
        "185",
        "210",
        "235",
        "260",
        "285",
        "310",
        "335",
        "355",
        "380",
        "405"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Power Snatch",
    "thresholds": {
      "male": [
        "135",
        "155",
        "175",
        "195",
        "215",
        "225",
        "235",
        "245",
        "255",
        "265"
      ],
      "female": [
        "95",
        "110",
        "120",
        "130",
        "145",
        "150",
        "160",
        "165",
        "175",
        "180"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Squat Snatch",
    "thresholds": {
      "male": [
        "135",
        "160",
        "190",
        "215",
        "240",
        "255",
        "270",
        "285",
        "300",
        "315"
      ],
      "female": [
        "95",
        "110",
        "125",
        "140",
        "155",
        "170",
        "180",
        "195",
        "205",
        "220"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Power Clean",
    "thresholds": {
      "male": [
        "185",
        "210",
        "230",
        "255",
        "280",
        "295",
        "315",
        "330",
        "350",
        "365"
      ],
      "female": [
        "135",
        "150",
        "160",
        "170",
        "185",
        "200",
        "215",
        "225",
        "240",
        "255"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Squat Clean",
    "thresholds": {
      "male": [
        "185",
        "220",
        "250",
        "280",
        "315",
        "335",
        "350",
        "370",
        "385",
        "405"
      ],
      "female": [
        "135",
        "155",
        "175",
        "195",
        "215",
        "225",
        "240",
        "250",
        "265",
        "275"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Clean & Jerk",
    "thresholds": {
      "male": [
        "185",
        "210",
        "240",
        "270",
        "295",
        "315",
        "330",
        "350",
        "365",
        "385"
      ],
      "female": [
        "135",
        "150",
        "170",
        "190",
        "205",
        "215",
        "220",
        "230",
        "235",
        "245"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 8,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Front Squat",
    "thresholds": {
      "male": [
        "225",
        "250",
        "280",
        "310",
        "335",
        "355",
        "380",
        "400",
        "425",
        "445"
      ],
      "female": [
        "155",
        "170",
        "185",
        "200",
        "215",
        "225",
        "240",
        "250",
        "265",
        "275"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 9,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Back Squat",
    "thresholds": {
      "male": [
        "245",
        "280",
        "310",
        "340",
        "375",
        "400",
        "425",
        "455",
        "480",
        "505"
      ],
      "female": [
        "165",
        "185",
        "205",
        "225",
        "245",
        "265",
        "285",
        "310",
        "330",
        "350"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 9,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Overhead Squat",
    "thresholds": {
      "male": [
        "155",
        "190",
        "225",
        "260",
        "295",
        "310",
        "325",
        "345",
        "360",
        "375"
      ],
      "female": [
        "105",
        "125",
        "145",
        "165",
        "185",
        "195",
        "210",
        "220",
        "235",
        "245"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 9,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Max Reps Bench (225/155)",
    "thresholds": {
      "male": [
        "1",
        "4",
        "6",
        "9",
        "12",
        "15",
        "18",
        "21",
        "23",
        "25"
      ],
      "female": [
        "1",
        "3",
        "6",
        "9",
        "11",
        "13",
        "16",
        "18",
        "21",
        "23"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 9,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "20 Rep Back Squat (lb)",
    "thresholds": {
      "male": [
        "165",
        "190",
        "215",
        "245",
        "270",
        "300",
        "325",
        "350",
        "380",
        "405"
      ],
      "female": [
        "115",
        "135",
        "150",
        "170",
        "185",
        "205",
        "220",
        "240",
        "255",
        "275"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 9,
    "categoryKey": "strength",
    "sourceSection": "Strength (1RM, lb)",
    "name": "Gwen in 10:00 (lb)",
    "thresholds": {
      "male": [
        "105",
        "115",
        "125",
        "135",
        "145",
        "155",
        "170",
        "185",
        "210",
        "225"
      ],
      "female": [
        "80",
        "85",
        "90",
        "95",
        "100",
        "105",
        "120",
        "135",
        "145",
        "155"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lb",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Max Strict Pull Up",
    "thresholds": {
      "male": [
        "5",
        "8",
        "12",
        "15",
        "18",
        "21",
        "25",
        "28",
        "32",
        "35"
      ],
      "female": [
        "3",
        "6",
        "9",
        "12",
        "15",
        "17",
        "19",
        "21",
        "23",
        "25"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Max Chest to Bar Pull Up",
    "thresholds": {
      "male": [
        "8",
        "16",
        "24",
        "32",
        "40",
        "45",
        "50",
        "55",
        "60",
        "65"
      ],
      "female": [
        "5",
        "11",
        "18",
        "24",
        "30",
        "35",
        "40",
        "45",
        "50",
        "55"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Weighted C2B Pull Up (lb)",
    "thresholds": {
      "male": [
        "BW",
        "+5",
        "25",
        "45",
        "55",
        "70",
        "85",
        "100",
        "115",
        "130"
      ],
      "female": [
        "BW",
        "+3",
        "10",
        "25",
        "35",
        "45",
        "55",
        "65",
        "75",
        "85"
      ]
    },
    "scheme": "load",
    "scoreType": "max",
    "inputUnit": "lbs_added",
    "includedInScoring": false,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": "Requires bodyweight-plus-added-load scoring that is intentionally deferred to v2."
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Max Toes to Bar (unbroken)",
    "thresholds": {
      "male": [
        "10",
        "15",
        "20",
        "25",
        "30",
        "42",
        "54",
        "66",
        "78",
        "90"
      ],
      "female": [
        "10",
        "12",
        "15",
        "18",
        "20",
        "28",
        "36",
        "44",
        "52",
        "60"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Max Strict HSPU",
    "thresholds": {
      "male": [
        "5",
        "9",
        "12",
        "16",
        "20",
        "26",
        "32",
        "38",
        "44",
        "50"
      ],
      "female": [
        "3",
        "6",
        "9",
        "12",
        "15",
        "20",
        "25",
        "30",
        "35",
        "40"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Max Kipping Ring Muscle Up",
    "thresholds": {
      "male": [
        "8",
        "10",
        "12",
        "13",
        "15",
        "18",
        "22",
        "25",
        "29",
        "32"
      ],
      "female": [
        "5",
        "6",
        "8",
        "9",
        "10",
        "12",
        "14",
        "16",
        "18",
        "20"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Max Bar Muscle Up",
    "thresholds": {
      "male": [
        "3",
        "6",
        "9",
        "12",
        "15",
        "20",
        "25",
        "30",
        "35",
        "40"
      ],
      "female": [
        "1",
        "3",
        "4",
        "6",
        "8",
        "12",
        "17",
        "21",
        "26",
        "30"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Max Strict Ring Dip",
    "thresholds": {
      "male": [
        "5",
        "10",
        "15",
        "20",
        "25",
        "29",
        "33",
        "37",
        "41",
        "45"
      ],
      "female": [
        "3",
        "7",
        "10",
        "14",
        "18",
        "21",
        "25",
        "28",
        "32",
        "35"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "L Sit Hold",
    "thresholds": {
      "male": [
        "00:00:10",
        "00:00:19",
        "00:00:28",
        "00:00:36",
        "00:00:45",
        "00:00:54",
        "00:01:03",
        "00:01:12",
        "00:01:21",
        "00:01:30"
      ],
      "female": [
        "00:00:10",
        "00:00:16",
        "00:00:22",
        "00:00:29",
        "00:00:35",
        "00:00:46",
        "00:00:57",
        "00:01:08",
        "00:01:19",
        "00:01:30"
      ]
    },
    "scheme": "time",
    "scoreType": "max",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 10,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "3:00 AMRAP GHDSU (reps)",
    "thresholds": {
      "male": [
        "30",
        "38",
        "47",
        "55",
        "63",
        "72",
        "80",
        "88",
        "97",
        "105"
      ],
      "female": [
        "30",
        "38",
        "47",
        "55",
        "63",
        "72",
        "80",
        "88",
        "97",
        "105"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 11,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Vertical Jump (in)",
    "thresholds": {
      "male": [
        "20",
        "22",
        "23",
        "25",
        "26",
        "28",
        "30",
        "33",
        "36",
        "38"
      ],
      "female": [
        "16",
        "17",
        "19",
        "20",
        "22",
        "24",
        "25",
        "27",
        "28",
        "30"
      ]
    },
    "scheme": "feet",
    "scoreType": "max",
    "inputUnit": "in",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 11,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Dead Hang",
    "thresholds": {
      "male": [
        "00:30",
        "01:00",
        "01:30",
        "02:00",
        "02:30",
        "03:00",
        "03:30",
        "04:00",
        "04:30",
        "05:00"
      ],
      "female": [
        "00:30",
        "00:53",
        "01:17",
        "01:40",
        "02:03",
        "02:27",
        "02:50",
        "03:13",
        "03:37",
        "04:00"
      ]
    },
    "scheme": "time",
    "scoreType": "max",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 11,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Unbroken Handstand Walk (ft)",
    "thresholds": {
      "male": [
        "10",
        "26",
        "42",
        "59",
        "75",
        "120",
        "165",
        "210",
        "255",
        "300"
      ],
      "female": [
        "10",
        "26",
        "42",
        "59",
        "75",
        "120",
        "165",
        "210",
        "255",
        "300"
      ]
    },
    "scheme": "feet",
    "scoreType": "max",
    "inputUnit": "ft",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 11,
    "categoryKey": "gymnastics",
    "sourceSection": "Gymnastics (max reps / time)",
    "name": "Unbroken Pegboard Ascents",
    "thresholds": {
      "male": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ],
      "female": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "BikeErg 20 min Avg Watts",
    "thresholds": {
      "male": [
        "150",
        "180",
        "210",
        "240",
        "270",
        "295",
        "320",
        "350",
        "375",
        "400"
      ],
      "female": [
        "100",
        "135",
        "170",
        "200",
        "235",
        "245",
        "255",
        "270",
        "280",
        "290"
      ]
    },
    "scheme": "points",
    "scoreType": "max",
    "inputUnit": "watts",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "Echo Bike 50 cal",
    "thresholds": {
      "male": [
        "00:02:45",
        "00:02:18",
        "00:01:50",
        "00:01:22",
        "00:00:55",
        "00:00:50",
        "00:00:45",
        "00:00:40",
        "00:00:35",
        "00:00:30"
      ],
      "female": [
        "00:04:00",
        "00:03:20",
        "00:02:40",
        "00:02:00",
        "00:01:20",
        "00:01:17",
        "00:01:14",
        "00:01:11",
        "00:01:08",
        "00:01:05"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "Ski Erg 2K",
    "thresholds": {
      "male": [
        "00:08:30",
        "00:08:15",
        "00:08:00",
        "00:07:45",
        "00:07:30",
        "00:07:20",
        "00:07:10",
        "00:07:00",
        "00:06:50",
        "00:06:40"
      ],
      "female": [
        "00:09:15",
        "00:09:00",
        "00:08:45",
        "00:08:30",
        "00:08:15",
        "00:08:06",
        "00:07:57",
        "00:07:48",
        "00:07:39",
        "00:07:30"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "Max Unbroken Double Unders",
    "thresholds": {
      "male": [
        "35",
        "76",
        "118",
        "159",
        "200",
        "260",
        "320",
        "380",
        "440",
        "500"
      ],
      "female": [
        "35",
        "76",
        "118",
        "159",
        "200",
        "260",
        "320",
        "380",
        "440",
        "500"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "Beat Bagent",
    "thresholds": {
      "male": [
        "00:14:00",
        "00:13:15",
        "00:12:30",
        "00:11:45",
        "00:11:00",
        "00:10:30",
        "00:10:00",
        "00:09:30",
        "00:09:00",
        "00:08:30"
      ],
      "female": [
        "00:16:00",
        "00:15:08",
        "00:14:15",
        "00:13:22",
        "00:12:30",
        "00:11:54",
        "00:11:18",
        "00:10:42",
        "00:10:06",
        "00:09:30"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "Regional Triple 3",
    "thresholds": {
      "male": [
        "00:50:00",
        "00:47:00",
        "00:44:00",
        "00:41:00",
        "00:38:00",
        "00:37:00",
        "00:36:00",
        "00:35:00",
        "00:34:00",
        "00:33:00"
      ],
      "female": [
        "00:55:00",
        "00:51:30",
        "00:48:00",
        "00:44:30",
        "00:41:00",
        "00:40:00",
        "00:39:00",
        "00:38:00",
        "00:37:00",
        "00:36:00"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "Acid Bath",
    "thresholds": {
      "male": [
        "05:35",
        "05:30",
        "05:25",
        "05:20",
        "05:15",
        "05:10",
        "05:05",
        "05:00",
        "04:55",
        "04:50"
      ],
      "female": [
        "06:00",
        "05:55",
        "05:50",
        "05:45",
        "05:40",
        "05:35",
        "05:30",
        "05:25",
        "05:20",
        "05:15"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "400m Sprint",
    "thresholds": {
      "male": [
        "00:01:40",
        "00:01:31",
        "00:01:22",
        "00:01:14",
        "00:01:05",
        "00:01:03",
        "00:01:01",
        "00:00:59",
        "00:00:57",
        "00:00:55"
      ],
      "female": [
        "00:01:45",
        "00:01:40",
        "00:01:35",
        "00:01:30",
        "00:01:25",
        "00:01:21",
        "00:01:17",
        "00:01:13",
        "00:01:09",
        "00:01:05"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "1 Mile Run",
    "thresholds": {
      "male": [
        "00:08:00",
        "00:07:30",
        "00:07:00",
        "00:06:30",
        "00:06:00",
        "00:05:48",
        "00:05:36",
        "00:05:24",
        "00:05:12",
        "00:05:00"
      ],
      "female": [
        "00:08:30",
        "00:08:08",
        "00:07:45",
        "00:07:22",
        "00:07:00",
        "00:06:44",
        "00:06:28",
        "00:06:12",
        "00:05:56",
        "00:05:40"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 12,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "5K Run",
    "thresholds": {
      "male": [
        "00:25:00",
        "00:24:00",
        "00:23:00",
        "00:22:00",
        "00:21:00",
        "00:20:18",
        "00:19:36",
        "00:18:54",
        "00:18:12",
        "00:17:30"
      ],
      "female": [
        "00:26:00",
        "00:25:15",
        "00:24:30",
        "00:23:45",
        "00:23:00",
        "00:22:06",
        "00:21:12",
        "00:20:18",
        "00:19:24",
        "00:18:30"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 13,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "10K Run",
    "thresholds": {
      "male": [
        "00:55:00",
        "00:52:15",
        "00:49:30",
        "00:46:45",
        "00:44:00",
        "00:42:36",
        "00:41:12",
        "00:39:48",
        "00:38:24",
        "00:37:00"
      ],
      "female": [
        "01:00:00",
        "00:57:00",
        "00:54:00",
        "00:51:00",
        "00:48:00",
        "00:46:08",
        "00:44:16",
        "00:42:24",
        "00:40:32",
        "00:38:40"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 13,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "500m Row",
    "thresholds": {
      "male": [
        "00:01:40",
        "00:01:36",
        "00:01:32",
        "00:01:29",
        "00:01:25",
        "00:01:24",
        "00:01:22",
        "00:01:21",
        "00:01:19",
        "00:01:18"
      ],
      "female": [
        "00:01:55",
        "00:01:50",
        "00:01:45",
        "00:01:40",
        "00:01:35",
        "00:01:34",
        "00:01:32",
        "00:01:31",
        "00:01:29",
        "00:01:28"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 13,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "2K Row",
    "thresholds": {
      "male": [
        "00:08:00",
        "00:07:44",
        "00:07:28",
        "00:07:11",
        "00:06:55",
        "00:06:47",
        "00:06:39",
        "00:06:31",
        "00:06:23",
        "00:06:15"
      ],
      "female": [
        "00:08:30",
        "00:08:15",
        "00:08:00",
        "00:07:45",
        "00:07:30",
        "00:07:23",
        "00:07:16",
        "00:07:09",
        "00:07:02",
        "00:06:55"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 13,
    "categoryKey": "engine",
    "sourceSection": "Engine (time / watts / reps)",
    "name": "5K Row",
    "thresholds": {
      "male": [
        "00:22:30",
        "00:21:38",
        "00:20:45",
        "00:19:52",
        "00:19:00",
        "00:18:32",
        "00:18:04",
        "00:17:36",
        "00:17:08",
        "00:16:40"
      ],
      "female": [
        "00:25:00",
        "00:24:00",
        "00:23:00",
        "00:22:00",
        "00:21:00",
        "00:20:30",
        "00:20:00",
        "00:19:30",
        "00:19:00",
        "00:18:30"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Fran",
    "thresholds": {
      "male": [
        "00:08:00",
        "00:06:45",
        "00:05:30",
        "00:04:15",
        "00:03:00",
        "00:02:47",
        "00:02:34",
        "00:02:21",
        "00:02:08",
        "00:01:55"
      ],
      "female": [
        "00:08:00",
        "00:06:45",
        "00:05:30",
        "00:04:15",
        "00:03:00",
        "00:02:47",
        "00:02:34",
        "00:02:21",
        "00:02:08",
        "00:01:55"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Diane",
    "thresholds": {
      "male": [
        "00:08:00",
        "00:06:41",
        "00:05:22",
        "00:04:04",
        "00:02:45",
        "00:02:36",
        "00:02:27",
        "00:02:18",
        "00:02:09",
        "00:02:00"
      ],
      "female": [
        "00:08:00",
        "00:06:44",
        "00:05:28",
        "00:04:11",
        "00:02:55",
        "00:02:46",
        "00:02:37",
        "00:02:28",
        "00:02:19",
        "00:02:10"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Helen",
    "thresholds": {
      "male": [
        "00:12:00",
        "00:10:51",
        "00:09:42",
        "00:08:34",
        "00:07:25",
        "00:07:19",
        "00:07:13",
        "00:07:07",
        "00:07:01",
        "00:06:55"
      ],
      "female": [
        "00:12:00",
        "00:11:00",
        "00:10:00",
        "00:09:00",
        "00:08:00",
        "00:07:51",
        "00:07:42",
        "00:07:33",
        "00:07:24",
        "00:07:15"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Grace",
    "thresholds": {
      "male": [
        "00:06:00",
        "00:04:58",
        "00:03:55",
        "00:02:52",
        "00:01:50",
        "00:01:42",
        "00:01:34",
        "00:01:26",
        "00:01:18",
        "00:01:10"
      ],
      "female": [
        "00:06:00",
        "00:04:58",
        "00:03:55",
        "00:02:52",
        "00:01:50",
        "00:01:42",
        "00:01:34",
        "00:01:26",
        "00:01:18",
        "00:01:10"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Isabel",
    "thresholds": {
      "male": [
        "00:06:00",
        "00:04:58",
        "00:03:55",
        "00:02:52",
        "00:01:50",
        "00:01:40",
        "00:01:30",
        "00:01:20",
        "00:01:10",
        "00:01:00"
      ],
      "female": [
        "00:06:00",
        "00:04:58",
        "00:03:55",
        "00:02:52",
        "00:01:50",
        "00:01:40",
        "00:01:30",
        "00:01:20",
        "00:01:10",
        "00:01:00"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Amanda",
    "thresholds": {
      "male": [
        "00:10:00",
        "00:08:28",
        "00:06:55",
        "00:05:22",
        "00:03:50",
        "00:03:42",
        "00:03:34",
        "00:03:26",
        "00:03:18",
        "00:03:10"
      ],
      "female": [
        "00:10:00",
        "00:09:08",
        "00:08:15",
        "00:07:22",
        "00:06:30",
        "00:05:56",
        "00:05:22",
        "00:04:48",
        "00:04:14",
        "00:03:40"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Elizabeth",
    "thresholds": {
      "male": [
        "00:08:00",
        "00:07:34",
        "00:07:08",
        "00:06:41",
        "00:06:15",
        "00:05:46",
        "00:05:17",
        "00:04:48",
        "00:04:19",
        "00:03:50"
      ],
      "female": [
        "00:08:00",
        "00:07:34",
        "00:07:08",
        "00:06:41",
        "00:06:15",
        "00:05:46",
        "00:05:17",
        "00:04:48",
        "00:04:19",
        "00:03:50"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Nancy",
    "thresholds": {
      "male": [
        "00:18:00",
        "00:16:38",
        "00:15:15",
        "00:13:52",
        "00:12:30",
        "00:12:00",
        "00:11:30",
        "00:11:00",
        "00:10:30",
        "00:10:00"
      ],
      "female": [
        "00:18:00",
        "00:16:45",
        "00:15:30",
        "00:14:15",
        "00:13:00",
        "00:12:24",
        "00:11:48",
        "00:11:12",
        "00:10:36",
        "00:10:00"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Murph (vest)",
    "thresholds": {
      "male": [
        "01:00:00",
        "00:54:15",
        "00:48:30",
        "00:42:45",
        "00:37:00",
        "00:36:36",
        "00:36:12",
        "00:35:48",
        "00:35:24",
        "00:35:00"
      ],
      "female": [
        "01:00:00",
        "00:55:30",
        "00:51:00",
        "00:46:30",
        "00:42:00",
        "00:41:12",
        "00:40:24",
        "00:39:36",
        "00:38:48",
        "00:38:00"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 14,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Cindy (rounds in 20)",
    "thresholds": {
      "male": [
        "10",
        "14",
        "18",
        "22",
        "26",
        "27",
        "28",
        "30",
        "31",
        "32"
      ],
      "female": [
        "10",
        "14",
        "18",
        "22",
        "26",
        "27",
        "28",
        "30",
        "31",
        "32"
      ]
    },
    "scheme": "rounds-reps",
    "scoreType": "max",
    "inputUnit": "rounds",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 15,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "100 Wall Ball / 100 Cal Row",
    "thresholds": {
      "male": [
        "00:14:00",
        "00:13:08",
        "00:12:15",
        "00:11:22",
        "00:10:30",
        "00:09:58",
        "00:09:26",
        "00:08:54",
        "00:08:22",
        "00:07:50"
      ],
      "female": [
        "00:16:00",
        "00:15:08",
        "00:14:15",
        "00:13:22",
        "00:12:30",
        "00:11:54",
        "00:11:18",
        "00:10:42",
        "00:10:06",
        "00:09:30"
      ]
    },
    "scheme": "time",
    "scoreType": "min",
    "inputUnit": "time",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 15,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Open 14.4 (reps)",
    "thresholds": {
      "male": [
        "160",
        "175",
        "180",
        "181",
        "185",
        "190",
        "200",
        "222",
        "240",
        "300"
      ],
      "female": [
        "145",
        "153",
        "162",
        "170",
        "180",
        "181",
        "189",
        "196",
        "205",
        "265"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 15,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Open 16.2 (time/reps)",
    "thresholds": {
      "male": [
        "90",
        "141",
        "192",
        "242",
        "293",
        "343",
        "423",
        "429",
        "19:59",
        "16:00"
      ],
      "female": [
        "90",
        "141",
        "192",
        "242",
        "293",
        "343",
        "423",
        "429",
        "19:59",
        "16:00"
      ]
    },
    "scheme": "time-with-cap",
    "scoreType": "min",
    "inputUnit": "hybrid_reps_time",
    "includedInScoring": false,
    "scoreModel": "hybrid",
    "hybridFlipTier": 9,
    "deferReason": "Requires hybrid reps-then-time scoring that is intentionally deferred to v2."
  },
  {
    "page": 15,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "7 min AMRAP Burpees (reps)",
    "thresholds": {
      "male": [
        "63",
        "75",
        "87",
        "98",
        "110",
        "123",
        "130",
        "138",
        "144",
        "150"
      ],
      "female": [
        "63",
        "75",
        "87",
        "98",
        "110",
        "123",
        "130",
        "138",
        "144",
        "150"
      ]
    },
    "scheme": "reps",
    "scoreType": "max",
    "inputUnit": "reps",
    "includedInScoring": true,
    "scoreModel": "standard",
    "hybridFlipTier": null,
    "deferReason": null
  },
  {
    "page": 15,
    "categoryKey": "benchmark_workout",
    "sourceSection": "Benchmark Workouts",
    "name": "Open 18.4 (reps/time)",
    "thresholds": {
      "male": [
        "62",
        "82",
        "103",
        "123",
        "144",
        "164",
        "8:30",
        "7:55",
        "6:50",
        "6:00"
      ],
      "female": [
        "35",
        "61",
        "87",
        "112",
        "138",
        "164",
        "8:00",
        "7:00",
        "6:20",
        "5:30"
      ]
    },
    "scheme": "time-with-cap",
    "scoreType": "min",
    "inputUnit": "hybrid_reps_time",
    "includedInScoring": false,
    "scoreModel": "hybrid",
    "hybridFlipTier": 7,
    "deferReason": "Requires hybrid reps-then-time scoring that is intentionally deferred to v2."
  }
] as const satisfies ReadonlyArray<RawBenchmarkTestRow>

export interface BenchmarkSeedTest extends RawBenchmarkTestRow {
	id: string
	position: number
	slug: string
	trackWorkoutId: string
	workoutId: string
}

function slugForBenchmarkTest(name: string): string {
	return name
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/\+/g, "plus")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
}

export const BENCHMARK_SEED_TESTS: ReadonlyArray<BenchmarkSeedTest> =
	RAW_BENCHMARK_TESTS.map((test, index) => {
		const slug = slugForBenchmarkTest(test.name)
		return {
			...test,
			id: `btst_training_guide_${slug}`,
			position: index + 1,
			slug,
			trackWorkoutId: `tw_training_guide_${slug}`,
			workoutId: `wod_training_guide_${slug}`,
		}
	})

function commonColumns(ts: string) {
	return { created_at: ts, updated_at: ts, update_counter: 0 }
}

function encodeThresholdValue(rawValue: string, test: BenchmarkSeedTest): number {
	let encoded: number | null

	if (test.inputUnit === "in") {
		const inches = Number.parseFloat(rawValue)
		encoded = Number.isFinite(inches)
			? encodeScore(String(inches / 12), "feet", { unit: "ft" })
			: null
	} else if (test.inputUnit === "ft") {
		encoded = encodeScore(rawValue, test.scheme, { unit: "ft" })
	} else if (test.inputUnit === "lb") {
		encoded = encodeScore(rawValue, test.scheme, { unit: "lbs" })
	} else {
		encoded = encodeScore(rawValue, test.scheme)
	}

	if (encoded === null) {
		throw new Error(
			`Unable to encode threshold ${rawValue} for ${test.name} (${test.inputUnit})`,
		)
	}

	return encoded
}

export function buildBenchmarkThresholdRows(ts: string) {
	return BENCHMARK_SEED_TESTS.flatMap((test) => {
		if (!test.includedInScoring) return []

		return (["male", "female"] as const).flatMap((variant) =>
			test.thresholds[variant].map((rawValue, index) => {
				const tier = index + 1
				return {
					id: `bthr_training_guide_${test.slug}_${variant}_t${tier}`,
					test_id: test.id,
					variant,
					tier,
					threshold_value: encodeThresholdValue(rawValue, test),
					raw_value: rawValue,
					...commonColumns(ts),
				}
			}),
		)
	})
}

const benchmarkScoringConfig = {
	algorithm: "absolute_tier",
	absoluteTier: { batteryId: BENCHMARK_SEED_IDS.batteryId },
	tiebreaker: { primary: "countback" },
	statusHandling: { dnf: "zero", dns: "zero", withdrawn: "zero" },
} as const

const benchmarkCompetitionSettings = {
	boardMode: "perpetual",
	divisions: { scalingGroupId: BENCHMARK_SEED_IDS.scalingGroupId },
	scoringConfig: benchmarkScoringConfig,
} as const

export function buildBenchmarkSeedRows(ts: string) {
	return {
		teams: [
			{
				id: BENCHMARK_SEED_IDS.competitionTeamId,
				name: "Training Guide Benchmark Athletes",
				slug: "training-guide-benchmark-athletes",
				type: "competition_event",
				description: "Athlete team for the generic benchmark board.",
				is_personal_team: 0,
				personal_team_owner_id: null,
				current_plan_id: null,
				parent_organization_id: BENCHMARK_SEED_IDS.organizingTeamId,
				...commonColumns(ts),
			},
		],
		teamMemberships: [
			{
				id: BENCHMARK_SEED_IDS.organizerMembershipId,
				team_id: BENCHMARK_SEED_IDS.competitionTeamId,
				user_id: BENCHMARK_SEED_IDS.organizerUserId,
				role_id: "admin",
				is_system_role: 1,
				joined_at: ts,
				is_active: 1,
				metadata: null,
				...commonColumns(ts),
			},
		],
		scalingGroups: [
			{
				id: BENCHMARK_SEED_IDS.scalingGroupId,
				title: "Benchmark Board Division",
				description: "Single Open division for the benchmark board.",
				team_id: BENCHMARK_SEED_IDS.organizingTeamId,
				is_default: 0,
				is_system: 0,
				...commonColumns(ts),
			},
		],
		scalingLevels: [
			{
				id: BENCHMARK_SEED_IDS.divisionId,
				scaling_group_id: BENCHMARK_SEED_IDS.scalingGroupId,
				label: "Open",
				position: 0,
				team_size: 1,
				...commonColumns(ts),
			},
		],
		competitions: [
			{
				id: BENCHMARK_SEED_IDS.competitionId,
				organizing_team_id: BENCHMARK_SEED_IDS.organizingTeamId,
				competition_team_id: BENCHMARK_SEED_IDS.competitionTeamId,
				group_id: null,
				slug: "training-guide-benchmark",
				name: "Training Guide Benchmark",
				description:
					"A generic, always-open benchmark board with one Open division and fixed tier thresholds.",
				start_date: "2026-01-01",
				end_date: "2026-12-31",
				registration_opens_at: "2026-01-01",
				registration_closes_at: null,
				timezone: "America/Denver",
				settings: JSON.stringify(benchmarkCompetitionSettings),
				default_registration_fee_cents: 0,
				visibility: "public",
				status: "published",
				competition_type: "benchmark",
				...commonColumns(ts),
			},
		],
		competitionDivisions: [
			{
				id: "cdiv_training_guide_benchmark_open",
				competition_id: BENCHMARK_SEED_IDS.competitionId,
				division_id: BENCHMARK_SEED_IDS.divisionId,
				fee_cents: 0,
				description: "Open individual benchmark division.",
				max_spots: null,
				...commonColumns(ts),
			},
		],
		programmingTracks: [
			{
				id: BENCHMARK_SEED_IDS.trackId,
				name: "Training Guide Benchmark Tests",
				description: "Generic benchmark tests seeded from a source training guide.",
				type: "team_owned",
				owner_team_id: BENCHMARK_SEED_IDS.organizingTeamId,
				scaling_group_id: BENCHMARK_SEED_IDS.scalingGroupId,
				is_public: 0,
				competition_id: BENCHMARK_SEED_IDS.competitionId,
				...commonColumns(ts),
			},
		],
		workouts: BENCHMARK_SEED_TESTS.map((test) => ({
			id: test.workoutId,
			name: test.name,
			description: test.includedInScoring
				? `Benchmark test using ${test.inputUnit} thresholds.`
				: `Deferred benchmark test: ${test.deferReason}`,
			scope: "public",
			scheme: test.scheme,
			score_type: test.scoreType,
			rounds_to_score: 1,
			team_id: BENCHMARK_SEED_IDS.organizingTeamId,
			time_cap: null,
			scaling_group_id: BENCHMARK_SEED_IDS.scalingGroupId,
			...commonColumns(ts),
		})),
		trackWorkouts: BENCHMARK_SEED_TESTS.map((test) => ({
			id: test.trackWorkoutId,
			track_id: BENCHMARK_SEED_IDS.trackId,
			workout_id: test.workoutId,
			parent_event_id: null,
			track_order: test.position,
			notes: test.includedInScoring ? null : test.deferReason,
			points_multiplier: 100,
			heat_status: "draft",
			event_status: test.includedInScoring ? "published" : "draft",
			benchmark_test_id: test.id,
			benchmark_category: test.categoryKey,
			...commonColumns(ts),
		})),
		competitionEvents: [],
		benchmarkBatteries: [
			{
				id: BENCHMARK_SEED_IDS.batteryId,
				owner_team_id: BENCHMARK_SEED_IDS.organizingTeamId,
				owner_key: `${BENCHMARK_SEED_IDS.organizingTeamId}:training-guide-benchmark-v1`,
				slug: "training-guide-benchmark-v1",
				name: "Training Guide Benchmark",
				description:
					"Generic benchmark battery extracted from a source training guide PDF.",
				categories: JSON.stringify(BENCHMARK_CATEGORIES),
				rating_bands: JSON.stringify(BENCHMARK_RATING_BANDS),
				max_tier: 10,
				score_max: 100,
				video_policy: "never",
				is_open_join: false,
				variant_scaling_group_id: null,
				competition_id: BENCHMARK_SEED_IDS.competitionId,
				status: "published",
				...commonColumns(ts),
			},
		],
		benchmarkTests: BENCHMARK_SEED_TESTS.map((test) => ({
			id: test.id,
			battery_id: BENCHMARK_SEED_IDS.batteryId,
			category_key: test.categoryKey,
			name: test.name,
			position: test.position,
			scheme: test.scheme,
			score_type: test.scoreType,
			input_unit: test.inputUnit,
			included_in_scoring: test.includedInScoring,
			time_cap_ms: null,
			score_model: test.scoreModel,
			hybrid_flip_tier: test.hybridFlipTier,
			hybrid_scale: test.scoreModel === "hybrid" ? test.deferReason : null,
			...commonColumns(ts),
		})),
		benchmarkTierThresholds: buildBenchmarkThresholdRows(ts),
	}
}
