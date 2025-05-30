"use client";

import { Movement } from "@/db/schema";
import { Workout } from "@/db/schema";
import { Tag } from "@/db/schema";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  movements: Movement[];
  tags: Tag[];
  createWorkoutAction: (data: {
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
  }) => Promise<void>;
}

export default function CreateWorkoutClient({
  movements,
  tags: initialTags,
  createWorkoutAction,
}: Props) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheme, setScheme] = useState<Workout["scheme"]>();
  const [scope, setScope] = useState<Workout["scope"]>("private");
  const [roundsToScore, setRoundsToScore] = useState<number | undefined>(
    undefined
  );
  const [repsPerRound, setRepsPerRound] = useState<number | undefined>(
    undefined
  );
  const router = useRouter();

  const handleAddTag = () => {
    if (newTag && !tags.some((t) => t.name === newTag)) {
      const id = crypto.randomUUID();
      setTags([
        ...tags,
        {
          id,
          name: newTag,
          createdAt: new Date(),
          updatedAt: new Date(),
          updateCounter: null,
        },
      ]);
      setSelectedTags([...selectedTags, id]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagId: string) => {
    setSelectedTags(selectedTags.filter((id) => id !== tagId));
  };

  const handleMovementToggle = (movementId: string) => {
    if (selectedMovements.includes(movementId)) {
      setSelectedMovements(selectedMovements.filter((id) => id !== movementId));
    } else {
      setSelectedMovements([...selectedMovements, movementId]);
    }
  };

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((id) => id !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const workoutId = crypto.randomUUID();

    if (!scheme) throw new Error("Must provide a workout scheme");

    await createWorkoutAction({
      workout: {
        id: workoutId,
        name,
        description,
        scheme,
        scope,
        roundsToScore: roundsToScore ?? null,
        repsPerRound: repsPerRound ?? null,
      },
      tagIds: selectedTags,
      movementIds: selectedMovements,
    });
    router.push(`/workouts/${workoutId}`);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workouts" className="btn-outline p-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1>CREATE WORKOUT</h1>
        </div>
      </div>

      <form className="border-2 border-black p-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <label
                htmlFor="workoutName"
                className="mb-2 block font-bold uppercase"
              >
                Workout Name
              </label>
              <input
                id="workoutName"
                type="text"
                className="input"
                placeholder="e.g., Fran, Cindy, Custom WOD"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block font-bold uppercase"
              >
                Description
              </label>
              <textarea
                id="description"
                className="textarea"
                rows={4}
                placeholder="Describe the workout (e.g., 21-15-9 reps for time of Thrusters and Pull-ups)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="scheme"
                className="mb-2 block font-bold uppercase"
              >
                Scheme
              </label>
              <select
                id="scheme"
                className="select"
                value={scheme}
                onChange={(e) => setScheme(e.target.value as Workout["scheme"])}
                required
              >
                <option value="">Select a scheme</option>
                <option value="time">For Time</option>
                <option value="time-with-cap">For Time (with cap)</option>
                <option value="rounds-reps">AMRAP (Rounds + Reps)</option>
                <option value="reps">Max Reps</option>
                <option value="emom">EMOM</option>
                <option value="load">Max Load</option>
                <option value="calories">Calories</option>
                <option value="meters">Meters</option>
                <option value="pass-fail">Pass/Fail</option>
              </select>
            </div>

            <div>
              <label htmlFor="scope" className="mb-2 block font-bold uppercase">
                Scope
              </label>
              <select
                id="scope"
                className="select"
                value={scope}
                onChange={(e) => setScope(e.target.value as Workout["scope"])}
                required
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="roundsToScore"
                className="mb-2 block font-bold uppercase"
              >
                Rounds to Score
              </label>
              <input
                id="roundsToScore"
                type="number"
                className="input"
                placeholder="e.g., 4 (default is 1)"
                value={roundsToScore === undefined ? "" : roundsToScore}
                onChange={(e) =>
                  setRoundsToScore(
                    e.target.value ? Number.parseInt(e.target.value) : undefined
                  )
                }
                min="0"
              />
            </div>

            <div>
              <label
                htmlFor="repsPerRound"
                className="mb-2 block font-bold uppercase"
              >
                Reps per Round (if applicable)
              </label>
              <input
                id="repsPerRound"
                type="number"
                className="input"
                placeholder="e.g., 10"
                value={repsPerRound === undefined ? "" : repsPerRound}
                onChange={(e) =>
                  setRepsPerRound(
                    e.target.value ? Number.parseInt(e.target.value) : undefined
                  )
                }
                min="0"
              />
            </div>

            <div>
              <label
                htmlFor="tagsInput"
                className="mb-2 block font-bold uppercase"
              >
                Tags
              </label>
              <div className="mb-2 flex gap-2">
                <input
                  id="tagsInput"
                  type="text"
                  className="input flex-1"
                  placeholder="Add a tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button type="button" className="btn" onClick={handleAddTag}>
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className={`flex cursor-pointer items-center border-2 border-black px-2 py-1 ${
                      selectedTags.includes(tag.id) ? "bg-black text-white" : ""
                    }`}
                  >
                    <span className="mr-2">{tag.name}</span>
                    {selectedTags.includes(tag.id) && (
                      <span className="text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="movementsInput"
              className="mb-2 block font-bold uppercase"
            >
              Movements
            </label>
            <div className="h-[500px] overflow-y-auto border-2 border-black p-4">
              <div className="space-y-2">
                {movements.map((movement) => (
                  <button
                    key={movement.id}
                    type="button"
                    onClick={() => handleMovementToggle(movement.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        handleMovementToggle(movement.id);
                    }}
                    className={`flex cursor-pointer items-center border-2 border-black px-2 py-1 ${
                      selectedMovements.includes(movement.id)
                        ? "bg-black text-white"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{movement.name}</span>
                      {selectedMovements.includes(movement.id) && (
                        <span className="text-xs">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <Link href="/workouts" className="btn-outline">
            Cancel
          </Link>
          <button type="submit" className="btn">
            Create Workout
          </button>
        </div>
      </form>
    </div>
  );
}
