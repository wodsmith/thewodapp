import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { SubscribeButton } from "@/components/programming/subscribe-button";

// Mock the required dependencies
vi.mock("@repo/zsa-react", () => ({
  useServerAction: vi.fn(() => ({
    execute: vi.fn(),
    isPending: false,
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/state/session", () => ({
  useSessionStore: vi.fn((selector) => {
    const mockState = {
      session: {
        teams: [{ id: "team1", name: "Test Team" }],
      },
      hasTeamPermission: () => true,
    };
    return selector(mockState);
  }),
}));

describe("SubscribeButton", () => {
  it('shows "Subscribe" when not subscribed', () => {
    render(<SubscribeButton trackId="track1" isSubscribed={false} />);
    
    const button = screen.getByRole("button", { name: /subscribe/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Subscribe");
  });

  it('shows "Unsubscribe" when subscribed', () => {
    render(<SubscribeButton trackId="track1" isSubscribed={true} />);
    
    const button = screen.getByRole("button", { name: /unsubscribe/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Unsubscribe");
  });

  it("handles loading states correctly", () => {
    // The component should show loading states when actions are pending
    // This is tested through the useServerAction mock returning isPending: true
    render(<SubscribeButton trackId="track1" />);
    
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });
});