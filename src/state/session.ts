import { SessionValidationResult } from '@/types';
import { create } from 'zustand'
import { combine } from 'zustand/middleware'
import { KVSession } from '@/utils/kv-session';

// Team member type extracted from KVSession for type safety
type TeamMember = NonNullable<KVSession['teams']>[number];

interface SessionState {
  session: SessionValidationResult | null;
  isLoading: boolean;
  lastFetched: Date | null;
  fetchSession?: () => Promise<void>;
}

interface SessionActions {
  setSession: (session: SessionValidationResult) => void;
  clearSession: () => void;
  refetchSession: () => void;

  // Team related selectors
  teams: () => KVSession['teams'] | undefined;
  isTeamMember: (teamId: string) => boolean;
  hasTeamRole: (teamId: string, roleId: string, isSystemRole?: boolean) => boolean;
  hasTeamPermission: (teamId: string, permission: string) => boolean;
  getTeam: (teamId: string) => TeamMember | undefined;
}

export const useSessionStore = create(
  combine(
    {
      session: null as SessionValidationResult | null,
      isLoading: true,
      lastFetched: null as Date | null,
      fetchSession: undefined,
    } as SessionState,
    (set, get) => ({
      setSession: (session: SessionValidationResult) => set({ session, isLoading: false, lastFetched: new Date() }),
      clearSession: () => set({ session: null, isLoading: false, lastFetched: null }),
      refetchSession: () => set({ isLoading: true }),

      // Team related selectors
      teams: () => get().session?.teams,

      isTeamMember: (teamId: string) => {
        return !!get().session?.teams?.some(team => team.id === teamId);
      },

      hasTeamRole: (teamId: string, roleId: string, isSystemRole: boolean = false) => {
        const team = get().session?.teams?.find(t => t.id === teamId);
        if (!team) return false;

        if (isSystemRole) {
          return team.role.isSystemRole && team.role.id === roleId;
        }

        return !team.role.isSystemRole && team.role.id === roleId;
      },

      hasTeamPermission: (teamId: string, permission: string) => {
        const team = get().session?.teams?.find(t => t.id === teamId);
        if (!team) return false;

        return team.permissions.includes(permission);
      },

      getTeam: (teamId: string) => {
        return get().session?.teams?.find(t => t.id === teamId);
      }
    } as SessionActions)
  )
)
