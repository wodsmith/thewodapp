import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CreateWorkoutClient from "./create-workout-client";

// Mock the createWorkoutAction
vi.mock("../../../../actions/createWorkoutAction", () => ({
  createWorkoutAction: vi.fn(),
}));

// Mock next/navigation useRouter
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockTags = [
  {
    id: "tag1",
    name: "Tag 1",
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: 0,
  },
  {
    id: "tag2",
    name: "Tag 2",
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: 0,
  },
];
const mockMovements = [
  {
    id: "move1",
    name: "Movement 1",
    type: "weightlifting",
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: 0,
  },
  {
    id: "move2",
    name: "Movement 2",
    type: "gymnastic",
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: 0,
  },
];
const mockCreateWorkoutAction = vi.fn();

function setup() {
  render(
    <CreateWorkoutClient
      tags={mockTags}
      movements={mockMovements}
      createWorkoutAction={mockCreateWorkoutAction}
    />
  );
}

describe("CreateWorkoutClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all expected fields", () => {
    setup();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/movements/i)).toBeInTheDocument();
  });

  it("handles user input and updates state", () => {
    setup();
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Test Workout" } });
    expect((nameInput as HTMLInputElement).value).toBe("Test Workout");
  });

  it("handles tag and movement selection", () => {
    setup();
    // Simulate clicking tag and movement buttons
    const tagButton = screen.getByText("Tag 2").closest("button");
    expect(tagButton).toBeInTheDocument();
    if (tagButton) fireEvent.click(tagButton);
    const movementButton = screen.getByText("Movement 2").closest("button");
    expect(movementButton).toBeInTheDocument();
    if (movementButton) fireEvent.click(movementButton);
  });

  it("submits form and calls createWorkoutAction", () => {
    setup();
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Test Workout" } });
    // Select a scheme to satisfy required field
    const schemeSelect = screen.getByLabelText(/scheme/i);
    fireEvent.change(schemeSelect, { target: { value: "time" } });
    const form = document.querySelector("form");
    expect(form).toBeInTheDocument();
    if (form) fireEvent.submit(form);
    expect(mockCreateWorkoutAction).toHaveBeenCalled();
  });
});
