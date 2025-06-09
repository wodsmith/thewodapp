import { getTeamInvitationsAction } from "@/actions/team-membership-actions";
import { useServerAction } from "zsa-react";
import React, { useEffect } from "react";

interface TeamInvitationsProps {
  teamId: string;
}

export function TeamInvitations({ teamId }: TeamInvitationsProps) {
  const [getInvites, { data, error, isLoading }] = useServerAction(
    getTeamInvitationsAction
  );

  useEffect(() => {
    console.log("Fetching team invitations for teamId:", teamId);
    getInvites({ teamId });
  }, [teamId, getInvites]);

  if (isLoading) return <div>Loading invitations...</div>;
  if (error) {
    console.error("Error loading invitations:", error);
    return <div>Error loading invitations</div>;
  }
  if (!data?.data?.length) return <div>No pending invitations.</div>;

  return (
    <div>
      <h3>Pending Invitations</h3>
      <ul>
        {data.data.map((invite: any) => (
          <li key={invite.id}>{invite.email} (invited)</li>
        ))}
      </ul>
    </div>
  );
}
