import type { KVSession } from "./utils/kv-session";

export type SessionValidationResult =
  | KVSession
  | null;

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
