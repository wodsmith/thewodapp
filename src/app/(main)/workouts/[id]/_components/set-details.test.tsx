import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SetDetails } from "./set-details";

vi.mock("@/lib/utils", () => ({
  formatSecondsToTime: (s: number) => `formatted-${s}`,
}));

describe("SetDetails", () => {
  it("renders all set info with full data", () => {
    const sets = [
      {
        id: "set1",
        setNumber: 1,
        reps: 10,
        weight: 100,
        distance: 200,
        time: 60,
        score: 5,
        notes: "Good set",
        resultId: "result1",
        status: "pass",
      },
    ];
    render(<SetDetails sets={sets} />);
    expect(screen.getByText("Set 1:")).toBeInTheDocument();
    expect(screen.getByText(/10 reps/)).toBeInTheDocument();
    expect(screen.getByText(/@ 100kg/)).toBeInTheDocument();
    expect(screen.getByText(/200m/)).toBeInTheDocument();
    expect(screen.getByText(/formatted-60/)).toBeInTheDocument();
    expect(screen.getByText(/Score: 5/)).toBeInTheDocument();
    expect(screen.getByText("(Good set)")).toBeInTheDocument();
  });

  it("renders with only reps and weight", () => {
    const sets = [
      {
        id: "set2",
        setNumber: 2,
        reps: 8,
        weight: 80,
        distance: null,
        time: null,
        score: null,
        notes: null,
        resultId: "result2",
        status: null,
      },
    ];
    render(<SetDetails sets={sets} />);
    expect(screen.getByText("Set 2:")).toBeInTheDocument();
    expect(screen.getByText(/8 reps/)).toBeInTheDocument();
    expect(screen.getByText(/@ 80kg/)).toBeInTheDocument();
  });

  it("renders nothing for null or empty sets", () => {
    const { container: c1 } = render(<SetDetails sets={null} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<SetDetails sets={[]} />);
    expect(c2.firstChild).toBeNull();
  });
});
