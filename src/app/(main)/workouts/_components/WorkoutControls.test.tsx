import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.mock("next/navigation", () => {
  globalThis.__mockReplace = vi.fn();
  globalThis.__searchParams = new URLSearchParams();
  return {
    useRouter: () => ({ replace: globalThis.__mockReplace }),
    usePathname: () => "/workouts",
    useSearchParams: () => globalThis.__searchParams,
  };
});

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import WorkoutControls from "./WorkoutControls";

describe("WorkoutControls", () => {
  beforeEach(() => {
    globalThis.__mockReplace.mockClear();
    globalThis.__searchParams = new URLSearchParams();
  });

  it("renders search input and dropdowns", () => {
    render(
      <WorkoutControls
        allTags={["tag1", "tag2"]}
        allMovements={["move1", "move2"]}
      />
    );
    expect(
      screen.getByPlaceholderText("Search workouts...")
    ).toBeInTheDocument();
    expect(screen.getByText("All Tags")).toBeInTheDocument();
    expect(screen.getByText("All Movements")).toBeInTheDocument();
    expect(screen.getByText("tag1")).toBeInTheDocument();
    expect(screen.getByText("move1")).toBeInTheDocument();
  });

  it("updates URL params when controls change", () => {
    render(<WorkoutControls allTags={["tag1"]} allMovements={["move1"]} />);
    fireEvent.change(screen.getByPlaceholderText("Search workouts..."), {
      target: { value: "Fran" },
    });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "tag1" } });
    fireEvent.change(selects[1], { target: { value: "move1" } });
    // The effect runs after each change, so replace should be called 4 times (initial + 3 changes)
    expect(globalThis.__mockReplace).toHaveBeenCalledTimes(4);
    expect(globalThis.__mockReplace).toHaveBeenLastCalledWith(
      "/workouts?search=Fran&tag=tag1&movement=move1",
      { scroll: false }
    );
  });
});
