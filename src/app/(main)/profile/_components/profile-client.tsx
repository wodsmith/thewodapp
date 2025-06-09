"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useServerAction } from "zsa-react";
import { toast } from "sonner";
import { updateUserNameAction } from "../actions";
import { getUserAction } from "@/actions/user-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Use the same type as returned by getUserFromDB
type ProfileUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  emailVerified: Date | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentCredits: number;
  lastCreditRefreshAt: Date | null;
};

interface ProfileClientProps {
  user: ProfileUser;
}

export default function ProfileClient({
  user: initialUser,
}: ProfileClientProps) {
  const [name, setName] = useState(initialUser.firstName || "");

  // Use the getUserAction to fetch fresh user data
  const {
    execute: fetchUser,
    data: userData,
    status: fetchStatus,
  } = useServerAction(getUserAction, {
    onError: (error) => {
      console.error("Failed to fetch user:", error);
      toast.error("Failed to load user data");
    },
  });

  // Use the updateUserNameAction to update the user's name
  const { execute: updateName, status: updateStatus } = useServerAction(
    updateUserNameAction,
    {
      onSuccess: (result) => {
        toast.success(result.data.message);
        // Refresh user data after successful update
        fetchUser();
      },
      onError: (error) => {
        console.error("Failed to update name:", error);
        toast.error("Failed to update name");
      },
    }
  );

  // Fetch fresh user data on component mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Update local state when fresh user data is received
  useEffect(() => {
    if (userData?.data?.firstName) {
      setName(userData.data.firstName);
    }
  }, [userData]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    await updateName({ firstName: name });
  };

  // Get the current user data (either fresh from server or initial)
  const currentUser = userData?.data || initialUser;
  const isLoading = updateStatus === "pending" || fetchStatus === "pending";

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <h1 className="mb-6 font-bold text-2xl">User Profile</h1>

      <div className="grid gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={currentUser.email || ""}
                  disabled
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="name">First Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  className="mt-1"
                  placeholder="Enter your first name"
                />
              </div>
              <Button
                className="bg-black text-white"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
