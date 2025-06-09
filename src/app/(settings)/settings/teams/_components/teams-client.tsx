"use client";

import { useState } from "react";
import { useServerAction } from "zsa-react";
import { toast } from "sonner";
import { getUserTeamsAction } from "@/actions/team-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Team } from "@/db/schema";
import { useSessionStore } from "@/state/session";

interface TeamsClientProps {
  teams: Team[];
}

export default function TeamsClient({ teams: initialTeams }: TeamsClientProps) {
  const [teams, setTeams] = useState(initialTeams);
  const session = useSessionStore();

  const { execute: fetchTeams } = useServerAction(getUserTeamsAction, {
    onSuccess: (data) => {
      setTeams(data.data || []);
    },
    onError: (error) => {
      console.error("Failed to fetch teams:", error);
      toast.error("Failed to load teams");
    },
  });

  const isPersonalTeam = (team: Team) => {
    return team.slug.includes(session.user?.id ?? "");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Teams</CardTitle>
          <CardDescription>
            You are a member of the following teams.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teams.length > 0 ? (
              teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <Link
                      href={`/dashboard/teams/${team.slug}`}
                      className="font-semibold hover:underline"
                    >
                      {team.name}
                    </Link>
                    {isPersonalTeam(team) && (
                      <Badge variant="secondary" className="ml-2">
                        Personal
                      </Badge>
                    )}
                  </div>
                  {/* You can add actions here, like "Leave Team" */}
                </div>
              ))
            ) : (
              <p>You are not a member of any teams.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
