import ProfileClient from "./_components/profile-client";

import type { Metadata } from "next";
import { requireVerifiedEmail } from "@/utils/auth";

export const metadata: Metadata = {
  metadataBase: new URL("https://spicywod.com"),
  title: "Spicy WOD | Profile",
  description: "Track your spicy workouts and progress.",
  openGraph: {
    title: "Spicy WOD | Profile", // Default title for layout
    description: "Track your spicy workouts and progress.", // Default description
    images: [
      {
        url: `/api/og?title=${encodeURIComponent("Spicy WOD | Profile")}`,
        width: 1200,
        height: 630,
        alt: "Spicy WOD | Profile",
      },
    ],
  },
};

export default async function ProfilePage() {
  const session = await requireVerifiedEmail();

  if (!session?.user) {
    console.log("[profile/page] No user found");
    return <div>Please log in to view your profile.</div>;
  }

  return <ProfileClient user={session.user} />;
}
