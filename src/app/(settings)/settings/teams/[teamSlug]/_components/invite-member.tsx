import { inviteUserAction } from "@/actions/team-membership-actions";
import { useServerAction } from "zsa-react";
import React, { useState } from "react";

interface InviteMemberProps {
  teamId: string;
  userRole: string;
}

export function InviteMember({ teamId, userRole }: InviteMemberProps) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [invite, { data, error, isLoading }] =
    useServerAction(inviteUserAction);

  if (userRole !== "owner") return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Inviting member:", { email, roleId });
    invite({ teamId, email, roleId });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          required
        />
      </div>
      <div>
        <label>Role ID</label>
        <input
          type="text"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="input"
          required
        />
      </div>
      <button type="submit" disabled={isLoading} className="btn">
        Invite
      </button>
      {error && <div className="text-red-500">Error: {error.message}</div>}
      {data?.success && <div className="text-green-500">Invitation sent!</div>}
    </form>
  );
}
