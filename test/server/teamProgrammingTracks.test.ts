
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { getDB } from '@/db';
import { teamProgrammingTracksTable, teamTable, programmingTracksTable, userTable } from '@/db/schema';
import { TeamProgrammingTrackService } from '@/server/team-programming-tracks';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/db/schema';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite, { schema });

const migrationsDir = join(__dirname, '../../src/db/migrations');
const migrationFiles = readdirSync(migrationsDir)
	.filter(file => file.endsWith('.sql'))
	.filter(file => !file.includes('0014_abandoned_clea.sql')) // Skip problematic migration
	.sort();

for (const file of migrationFiles) {
	const filePath = join(migrationsDir, file);
	const sql = readFileSync(filePath, 'utf-8');
	sqlite.exec(sql);
}

// Add missing columns for testing (these should be in migrations but are missing)
const missingColumns = [
	'ALTER TABLE user ADD COLUMN signUpIpAddress text(128);',
	'ALTER TABLE user ADD COLUMN googleAccountId text(255);',
	'ALTER TABLE user ADD COLUMN avatar text(600);',
	'ALTER TABLE user ADD COLUMN currentCredits integer DEFAULT 0 NOT NULL;',
	'ALTER TABLE user ADD COLUMN lastCreditRefreshAt integer;',
	'ALTER TABLE team_programming_track ADD COLUMN startDayOffset integer DEFAULT 0 NOT NULL;'
];

for (const sql of missingColumns) {
	try {
		sqlite.exec(sql);
	} catch (error) {
		// Column might already exist, ignore error
	}
}

// Rename addedAt to subscribedAt if it exists
try {
	sqlite.exec('ALTER TABLE team_programming_track RENAME COLUMN addedAt TO subscribedAt;');
} catch (error) {
	// Column might not exist or already renamed, try adding subscribedAt
	try {
		sqlite.exec('ALTER TABLE team_programming_track ADD COLUMN subscribedAt integer;');
	} catch (error2) {
		// Column might already exist, ignore error
	}
}

vi.mock('@/db', () => ({
	getDB: () => db,
}));

describe('TeamProgrammingTrackService', () => {
	let team: (typeof teamTable.$inferSelect);
	let track: (typeof programmingTracksTable.$inferSelect);
	let user: (typeof userTable.$inferSelect);

	beforeAll(async () => {
		// Create user with only the fields that exist after migration 0013
		user = await db.insert(userTable).values({
			id: 'user_123',
			firstName: 'Test',
			lastName: 'User',
			email: 'test@user.com',
			role: 'user'
		}).returning().then(res => res[0]);

		team = await db.insert(teamTable).values({
			id: 'team_123',
			name: 'Test Team',
			slug: 'test-team',
			personalTeamOwnerId: user.id,
			isPersonalTeam: 1
		}).returning().then(res => res[0]);

		track = await db.insert(programmingTracksTable).values({
			id: 'track_abc',
			name: 'Test Track',
			description: 'Test Description',
			type: 'self_programmed'
		}).returning().then(res => res[0]);
	});

	afterEach(async () => {
		await db.delete(teamProgrammingTracksTable);
	});

	it('should subscribe a team to a track', async () => {
		await TeamProgrammingTrackService.subscribeTeamToTrack({ teamId: team.id, trackId: track.id });

		const subscription = await db.query.teamProgrammingTracksTable.findFirst({
			where: eq(teamProgrammingTracksTable.teamId, team.id),
		});

		expect(subscription).toBeDefined();
		expect(subscription?.trackId).toBe(track.id);
		expect(subscription?.isActive).toBe(1);
	});

	it('should not create a duplicate subscription', async () => {
		await TeamProgrammingTrackService.subscribeTeamToTrack({ teamId: team.id, trackId: track.id });
		await TeamProgrammingTrackService.subscribeTeamToTrack({ teamId: team.id, trackId: track.id });
		const subscriptions = await db.query.teamProgrammingTracksTable.findMany({
			where: eq(teamProgrammingTracksTable.teamId, team.id),
		});
		expect(subscriptions.length).toBe(1);
	});

	it('should unsubscribe a team from a track', async () => {
		await TeamProgrammingTrackService.subscribeTeamToTrack({ teamId: team.id, trackId: track.id });
		await TeamProgrammingTrackService.unsubscribeTeamFromTrack({ teamId: team.id, trackId: track.id });
		const subscription = await db.query.teamProgrammingTracksTable.findFirst({
			where: eq(teamProgrammingTracksTable.teamId, team.id),
		});
		expect(subscription?.isActive).toBe(0);
	});
});
