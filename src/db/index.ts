import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "./schema";

export let db: DrizzleD1Database<typeof schema> | null = null;

export const getDB = () => {
  if (db) {
    return db;
  }

  const { env } = getCloudflareContext();

  if (!env.NEXT_TAG_CACHE_D1) {
    throw new Error("D1 database not found");
  }

  db = drizzle(env.NEXT_TAG_CACHE_D1, { schema, logger: true });

  return db;
};
