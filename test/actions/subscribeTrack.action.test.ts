import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscribeTrackAction } from '@/actions/subscribe-track.action';

// Mock the dependencies
vi.mock('@/utils/auth', () => ({
	getSessionFromCookie: vi.fn(),
}));

vi.mock('@/server/team-programming-tracks', () => ({
	TeamProgrammingTrackService: {
		subscribeTeamToTrack: vi.fn(),
	},
}));

vi.mock('@/server/teams', () => ({
	getUserPersonalTeam: vi.fn(),
}));

describe('subscribeTrackAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return error when not authenticated', async () => {
		const { getSessionFromCookie } = await import('@/utils/auth');
		vi.mocked(getSessionFromCookie).mockResolvedValue(null);

		const [data, error] = await subscribeTrackAction({ trackId: 'track_123' });

		expect(data).toBeNull();
		expect(error).toBeDefined();
		expect(error?.message).toBe('Not authenticated');
	});

	it('should subscribe with provided teamId', async () => {
		const { getSessionFromCookie } = await import('@/utils/auth');
		const { TeamProgrammingTrackService } = await import('@/server/team-programming-tracks');

		vi.mocked(getSessionFromCookie).mockResolvedValue({
			user: { id: 'user_123' },
		} as any);

		vi.mocked(TeamProgrammingTrackService.subscribeTeamToTrack).mockResolvedValue({
			success: true,
			data: {},
		});

		const [data, error] = await subscribeTrackAction({
			trackId: 'track_123',
			teamId: 'team_456',
		});

		expect(error).toBeNull();
		expect(data).toEqual({ success: true });
		expect(TeamProgrammingTrackService.subscribeTeamToTrack).toHaveBeenCalledWith({
			teamId: 'team_456',
			trackId: 'track_123',
		});
	});

	it('should use personal team when teamId not provided', async () => {
		const { getSessionFromCookie } = await import('@/utils/auth');
		const { TeamProgrammingTrackService } = await import('@/server/team-programming-tracks');
		const { getUserPersonalTeam } = await import('@/server/teams');

		vi.mocked(getSessionFromCookie).mockResolvedValue({
			user: { id: 'user_123' },
		} as any);

		vi.mocked(getUserPersonalTeam).mockResolvedValue({
			id: 'personal_team_123',
		} as any);

		vi.mocked(TeamProgrammingTrackService.subscribeTeamToTrack).mockResolvedValue({
			success: true,
			data: {},
		});

		const [data, error] = await subscribeTrackAction({
			trackId: 'track_123',
		});

		expect(error).toBeNull();
		expect(data).toEqual({ success: true });
		expect(getUserPersonalTeam).toHaveBeenCalledWith('user_123');
		expect(TeamProgrammingTrackService.subscribeTeamToTrack).toHaveBeenCalledWith({
			teamId: 'personal_team_123',
			trackId: 'track_123',
		});
	});
});