import { getUserTeamsAction } from "@/actions/team-actions";
import TeamsClient from "./_components/teams-client";
import { getSessionFromCookie } from "@/utils/auth";
import { redirect } from "next/navigation";

export default async function TeamsPage() {
  const session = await getSessionFromCookie();
  if (!session) {
    redirect("/sign-in");
  }

  const [result, _error] = await getUserTeamsAction();

  if (!result || result?.success === false) {
    redirect("/settings");
  }

  const teams = result.data || [];

  return <TeamsClient teams={teams} />;
}
