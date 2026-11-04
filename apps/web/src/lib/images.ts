import exifr from "exifr";

import type { ImageMetadataFields } from "@ww/types";

import { supabase } from "./supabase.js";

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export type ImageUploadMeta = Pick<
  ImageMetadataFields,
  "taken_at" | "latitude" | "longitude"
>;

export async function readImageMetadata(file: File): Promise<ImageUploadMeta> {
  let takenAt = new Date(file.lastModified);
  let latitude: number | null = null;
  let longitude: number | null = null;

  try {
    const parsed = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"],
    });

    if (parsed) {
      const exifDate =
        parsed.DateTimeOriginal ?? parsed.CreateDate ?? undefined;
      if (exifDate instanceof Date && !Number.isNaN(exifDate.getTime())) {
        takenAt = exifDate;
      }

      if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
        latitude = parsed.latitude;
        longitude = parsed.longitude;
      }
    }
  } catch {
    // Use file lastModified when EXIF is missing or unreadable.
  }

  if (Number.isNaN(takenAt.getTime())) {
    takenAt = new Date();
  }

  return {
    taken_at: takenAt.toISOString(),
    latitude,
    longitude,
  };
}

export async function downscaleImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not process image");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress image"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export async function uploadImage(
  uid: string,
  file: File,
): Promise<{ path: string; meta: ImageUploadMeta }> {
  const meta = await readImageMetadata(file);
  const blob = await downscaleImage(file);
  const path = `${uid}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from("images").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return { path, meta };
}

export async function getSignedImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("images")
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not load image");
  }

  return data.signedUrl;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
