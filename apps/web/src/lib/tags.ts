export function suggestTagFromName(name: string): string {
  let tag = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);

  if (!tag) {
    tag = "page";
  }

  if (!/^[a-z0-9]/.test(tag)) {
    tag = `p${tag}`.slice(0, 30);
  }

  if (tag.length < 2) {
    tag = `${tag}x`.slice(0, 30);
  }

  return tag;
}

export function sanitizeTagInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 30);
}
