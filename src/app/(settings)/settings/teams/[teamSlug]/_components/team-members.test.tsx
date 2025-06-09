import { render, screen, waitFor } from "@testing-library/react";
import { TeamMembers } from "./team-members";
import * as zsaReact from "zsa-react";

const mockMembers = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

describe("TeamMembers", () => {
  it("renders a list of members returned from getTeamMembersAction", async () => {
    jest
      .spyOn(zsaReact, "useServerAction")
      .mockReturnValue([
        jest.fn(),
        { data: { data: mockMembers }, error: null, isLoading: false },
      ]);
    render(<TeamMembers teamId="team-1" />);
    await waitFor(() => {
      expect(screen.getByText("Alice (alice@example.com)")).toBeInTheDocument();
      expect(screen.getByText("Bob (bob@example.com)")).toBeInTheDocument();
    });
  });
});
