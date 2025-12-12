"use server"
export async function getTrackWorkouts(trackId: string, page: number = 1) {
  return { workouts: [], totalPages: 0 }
}
