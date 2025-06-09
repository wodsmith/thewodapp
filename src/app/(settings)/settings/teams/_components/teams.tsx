import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import type { Team } from "@/db/schema";

interface TeamsClientProps {
  teams: Team[];
}

export default function TeamsClient({ teams }: TeamsClientProps) {
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
                      href={`/settings/teams/${team.slug}`}
                      className="font-semibold hover:underline"
                    >
                      {team.name}
                    </Link>
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
