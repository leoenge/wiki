import { db } from "../db.js";
import { HttpError } from "../http.js";
import type { ImageMetadataFields } from "@ww/types";

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

async function isImageOnPage(
  pageId: string,
  path: string,
): Promise<boolean> {
  const { data: pageRow, error: pageError } = await db
    .from("pages")
    .select("main_image_path")
    .eq("id", pageId)
    .maybeSingle();

  if (pageError) {
    console.error(pageError);
    throw new HttpError(500, "Failed to validate image");
  }

  if (pageRow?.main_image_path === path) {
    return true;
  }

  const { data: elementRow, error: elementError } = await db
    .from("page_elements")
    .select("id")
    .eq("page_id", pageId)
    .eq("image_path", path)
    .limit(1)
    .maybeSingle();

  if (elementError) {
    console.error(elementError);
    throw new HttpError(500, "Failed to validate image");
  }

  return Boolean(elementRow);
}

export async function assertImageUsableOnPage(
  uid: string,
  pageId: string,
  path: string,
): Promise<void> {
  const prefix = `${uid}/`;
  if (path.startsWith(prefix)) {
    await assertOwnedImage(uid, path);
    return;
  }

  if (!(await isImageOnPage(pageId, path))) {
    throw new HttpError(400, "Invalid image path");
  }

  const { data, error } = await db
    .from("images")
    .select("id")
    .eq("path", path)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to validate image");
  }

  if (!data) {
    throw new HttpError(400, "Image not found");
  }
}

export async function registerImage(
  uid: string,
  path: string,
  meta: Partial<ImageMetadataFields> & { taken_at?: string },
): Promise<string> {
  await assertOwnedImage(uid, path);

  const takenAt = meta.taken_at ?? new Date().toISOString();

  const { data, error } = await db
    .from("images")
    .upsert(
      {
        owner_id: uid,
        path,
        taken_at: takenAt,
        latitude: meta.latitude ?? null,
        longitude: meta.longitude ?? null,
      },
      { onConflict: "path" },
    )
    .select("id")
    .single();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to register image");
  }

  return data.id;
}
