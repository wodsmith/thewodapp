import { createWorkoutAction } from "@/actions/workout-actions";
import type { Movement, Tag, Workout } from "@/db/schema";
import { fromZonedTime } from "date-fns-tz";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import CreateWorkoutClient from "./_components/create-workout-client";

import type { Metadata } from "next";
import { getAllTagsAction } from "@/actions/tag-actions";
import { getAllMovementsAction } from "@/actions/movement-actions";
import { getSessionFromCookie } from "@/utils/auth";

export const metadata: Metadata = {
  metadataBase: new URL("https://spicywod.com"),
  title: "Spicy WOD | Create Workout",
  description: "Track your spicy workouts and progress.",
  openGraph: {
    title: "Spicy WOD | Create Workout", // Default title for layout
    description: "Track your spicy workouts and progress.", // Default description
    images: [
      {
        url: `/api/og?title=${encodeURIComponent(
          "Spicy WOD | Create Workout"
        )}`,
        width: 1200,
        height: 630,
        alt: "Spicy WOD | Create Workout",
      },
    ],
  },
};

export default async function CreateWorkoutPage() {
  const [movements, movementsError] = await getAllMovementsAction();
  const [tags, tagsError] = await getAllTagsAction();

  if (movementsError || tagsError || !movements?.success || !tags?.success) {
    return notFound();
  }

  const session = await getSessionFromCookie();

  if (!session?.user?.id) {
    console.log("[log/page] No user found");
    redirect("/login");
  }

  async function createWorkoutActionHandler(data: {
    workout: Omit<
      Workout,
      | "createdAt"
      | "updatedAt"
      | "updateCounter"
      | "userId"
      | "tiebreakScheme"
      | "secondaryScheme"
      | "sugarId"
    >;
    tagIds: Tag["id"][];
    movementIds: Movement["id"][];
  }) {
    "use server";
    if (!session?.user?.id) {
      console.log("[log/page] No user found");
      throw new Error("No user found");
    }

    const headerList = await headers();
    const timezone = headerList.get("x-vercel-ip-timezone") ?? "America/Denver";
    const date = new Date().toISOString().split("T")[0];
    const createdAtDate = fromZonedTime(`${date}T00:00:00`, timezone);

    try {
      await createWorkoutAction({
        workout: {
          ...data.workout,
          createdAt: createdAtDate,
          tiebreakScheme: null,
          secondaryScheme: null,
          sugarId: null,
        },
        tagIds: data.tagIds,
        movementIds: data.movementIds,
        userId: session?.user?.id,
      });
    } catch (error) {
      console.error("[log/page] Error creating workout", error);
      throw new Error("Error creating workout");
    }
    // Revalidate or redirect if necessary after creation,
    // but client-side redirect is already handled in CreateWorkoutClient
  }

  return (
    <CreateWorkoutClient
      movements={movements.data}
      tags={tags.data}
      createWorkoutAction={createWorkoutActionHandler}
    />
  );
}
