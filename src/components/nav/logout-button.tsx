"use client";

import { LogOut } from "lucide-react";
// import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button type="button" className="font-bold" onClick={() => {}}>
      <LogOut className="h-5 w-5" />
    </button>
  );
}
