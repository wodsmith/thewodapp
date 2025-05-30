import { Metadata } from "next";
import { getSessionFromCookie } from "@/utils/auth";
import { redirect } from "next/navigation";
import TeamInviteClientComponent from "./team-invite.client";

export const metadata: Metadata = {
  title: "Accept Team Invitation",
  description: "Accept an invitation to join a team",
};

export default async function TeamInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await getSessionFromCookie();
  const token = (await searchParams)?.token;

  // If no token is provided, redirect to sign in
  if (!token) {
    return redirect('/sign-in');
  }

  // If user is not logged in, redirect to sign in with return URL
  if (!session) {
    const returnUrl = `/team-invite?token=${token}`;
    return redirect(`/sign-in?redirect=${encodeURIComponent(returnUrl)}`);
  }

  return <TeamInviteClientComponent />;
}
