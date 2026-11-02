import type { User } from "@supabase/supabase-js";

export function displayNameFromUser(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
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

export function contributorNameForImagePath(
  imagePath: string,
  currentUser: User | null,
): string {
  const uploaderId = imagePath.split("/")[0];
  if (currentUser && currentUser.id === uploaderId) {
    return displayNameFromUser(currentUser);
  }
  return "Unknown";
}
