import MainNav from "@/components/nav/main-nav";
import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://spicywod.com"),
  openGraph: {
    title: "Spicy WOD", // Default title for layout
    description: "Track your spicy workouts and progress.", // Default description
    images: [
      {
        url: `/api/og?title=${encodeURIComponent("Spicy WOD")}`,
        width: 1200,
        height: 630,
        alt: "Spicy WOD",
      },
    ],
  },
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <main className="container mx-auto flex-1 p-4">{children}</main>

      <footer className="border-black border-t-2 p-4">
        <div className="container mx-auto">
          <p className="text-center">
            &copy; {new Date().getFullYear()} spicy wod. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
