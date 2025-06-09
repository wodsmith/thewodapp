import { redirect } from "next/navigation";

export default function SettingsIndexRedirect() {
  redirect("/settings/profile");
}
