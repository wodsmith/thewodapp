import type { KVSession } from "./utils/kv-session";
import type { Workout, Movement, Tag, Result, Set } from "@/db/schema";

export type SessionValidationResult = KVSession | null;

// Workout related types
export type WorkoutResult = Result;
export type ResultSet = Set;

export type WorkoutResultWithWorkoutName = Result & {
  workoutName?: string;
};

export type ResultSetInput = {
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  status?: "pass" | "fail" | null;
  distance?: number | null;
  time?: number | null;
  score?: number | null;
};

export type WorkoutWithTagsAndMovements = Workout & {
  tags: Tag[];
  movements: Movement[];
};

export type WorkoutUpdate = Partial<
  Pick<
    Workout,
    | "name"
    | "description"
    | "scheme"
    | "scope"
    | "repsPerRound"
    | "roundsToScore"
  >
>;

export interface ParsedUserAgent {
  ua: string;
  browser: {
    name?: string;
    version?: string;
    major?: string;
  };
  device: {
    model?: string;
    type?: string;
    vendor?: string;
  };
  engine: {
    name?: string;
    version?: string;
  };
  os: {
    name?: string;
    version?: string;
  };
}

export interface SessionWithMeta extends KVSession {
  isCurrentSession: boolean;
  expiration?: Date;
  createdAt: number;
  userAgent?: string | null;
  parsedUserAgent?: ParsedUserAgent;
}

// Re-export common types for convenience
export type { Workout, Movement, Tag } from "@/db/schema";
