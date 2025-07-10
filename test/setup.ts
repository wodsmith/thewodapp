import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/db/schema';

const sqlite = new Database(':memory:');
export const db = drizzle(sqlite, { schema });

vi.mock('@/db', () => ({
  getDB: () => db,
}));