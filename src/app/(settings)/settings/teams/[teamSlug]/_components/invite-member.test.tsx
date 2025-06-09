import { render, screen, fireEvent } from "@testing-library/react";
import { InviteMember } from "./invite-member";
import * as zsaReact from "zsa-react";

describe("InviteMember", () => {
  it("calls inviteUserAction with correct email and role", () => {
    const inviteMock = jest.fn();
    jest
      .spyOn(zsaReact, "useServerAction")
      .mockReturnValue([
        inviteMock,
        { data: null, error: null, isLoading: false },
      ]);
    render(<InviteMember teamId="team-1" userRole="owner" />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/role id/i), {
      target: { value: "admin" },
    });
    fireEvent.click(screen.getByText(/invite/i));
    expect(inviteMock).toHaveBeenCalledWith({
      teamId: "team-1",
      email: "test@example.com",
      roleId: "admin",
    });
  });

  it("does not render for non-owner role", () => {
    render(<InviteMember teamId="team-1" userRole="member" />);
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });
});
