"use client";
import { getTeamInvitationsAction } from "@/actions/team-membership-actions";
import { useServerAction } from "zsa-react";
import React, { useEffect } from "react";

interface TeamInvitationsProps {
  teamId: string;
}

interface TeamInvitationListItem {
  id?: string;
  email?: string;
  roleId?: string;
  isSystemRole?: boolean;
  createdAt?: Date;
  expiresAt?: Date | null;
  invitedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    avatar: string | null;
  };
}

export function TeamInvitations({ teamId }: TeamInvitationsProps) {
  const { execute, data, error, isPending } = useServerAction(
    getTeamInvitationsAction
  );

  useEffect(() => {
    execute({ teamId });
  }, [teamId, execute]);

  if (isPending) return <div>Loading invitations...</div>;
  if (error) {
    console.error("Error loading invitations:", error);
    return <div>Error loading invitations</div>;
  }
  if (!data?.data?.length) return <div>No pending invitations.</div>;

  return (
    <div>
      <h3>Pending Invitations</h3>
      <ul>
        {data.data.map((invite: TeamInvitationListItem) => {
          if (!invite?.invitedBy?.email || !invite?.id) return null;

          return <li key={invite.id}>{invite.email} (invited)</li>;
        })}
      </ul>
    </div>
  );
}
