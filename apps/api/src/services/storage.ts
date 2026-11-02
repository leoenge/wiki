import { db } from "../db.js";
import { HttpError } from "../http.js";

const IMAGES_BUCKET = "images";

export function assertImagePathPrefix(uid: string, path: string): void {
  const prefix = `${uid}/`;
  if (!path.startsWith(prefix) || path.length <= prefix.length) {
    throw new HttpError(400, "Invalid image path");
  }
}

export async function assertOwnedImage(uid: string, path: string): Promise<void> {
  assertImagePathPrefix(uid, path);

  const { data, error } = await db.storage.from(IMAGES_BUCKET).download(path);

  if (error || !data) {
    throw new HttpError(400, "Image not found");
  }
}
