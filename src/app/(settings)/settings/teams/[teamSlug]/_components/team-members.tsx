import { getTeamMembersAction } from "@/actions/team-membership-actions";
import { useServerAction } from "zsa-react";
import React, { useEffect } from "react";

interface TeamMembersProps {
  teamId: string;
}

export function TeamMembers({ teamId }: TeamMembersProps) {
  const [getMembers, { data, error, isLoading }] =
    useServerAction(getTeamMembersAction);

  useEffect(() => {
    console.log("Fetching team members for teamId:", teamId);
    getMembers({ teamId });
  }, [teamId, getMembers]);

  if (isLoading) return <div>Loading team members...</div>;
  if (error) {
    console.error("Error loading team members:", error);
    return <div>Error loading team members</div>;
  }
  if (!data?.data?.length) return <div>No team members found.</div>;

  return (
    <div>
      <h3>Team Members</h3>
      <ul>
        {data.data.map((member: any) => (
          <li key={member.id}>
            {member.name} ({member.email})
          </li>
        ))}
      </ul>
    </div>
  );
}
