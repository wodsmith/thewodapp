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
  selectedTeamSlug: string;
}

export function TeamsClient({ teams, selectedTeamSlug }: TeamsClientProps) {
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
          <div className="space-y-2">
            {teams.length > 0 ? (
              teams.map((team) => {
                const isActive = team.slug === selectedTeamSlug;
                return (
                  <Link
                    key={team.id}
                    href={`/settings/teams/${team.slug}`}
                    className={`block rounded-lg border px-4 py-2 font-semibold transition-colors sm:w-1/2 ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow"
                        : "hover:bg-muted hover:border-muted-foreground"
                    }`}
                  >
                    {team.name}
                  </Link>
                );
              })
            ) : (
              <p>You are not a member of any teams.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
