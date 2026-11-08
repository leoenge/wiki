import type { User } from "@supabase/supabase-js";

export function displayNameFromUser(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const firstName = metadata?.first_name;
  if (typeof firstName === "string" && firstName.trim()) {
    return firstName.trim();
  }
  const fullName = metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }
  const name = metadata?.name;
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }
  if (user.email) {
    return user.email.split("@")[0] ?? user.email;
  }
  return "Unknown";
}

