import type { PageElement } from "./api/elements.js";

export function groupElementsByParent(
  elements: PageElement[],
): Map<string | null, PageElement[]> {
  const map = new Map<string | null, PageElement[]>();

  for (const element of elements) {
    const key = element.parent_id;
    const list = map.get(key) ?? [];
    list.push(element);
    map.set(key, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  return map;
}

export function flattenPageElements(elements: PageElement[]): PageElement[] {
  const grouped = groupElementsByParent(elements);
  const flat: PageElement[] = [];

  for (const root of grouped.get(null) ?? []) {
    flat.push(root);
    if (root.type === "section") {
      flat.push(...(grouped.get(root.id) ?? []));
    }
  }

  return flat;
}

export type ElementAssignment = {
  id: string;
  parent_id: string | null;
  position: number;
};

type ElementOrderNode = Pick<PageElement, "id" | "type">;

export function assignmentsFromFlatOrder(
  flatIds: string[],
  elementsById: Map<string, ElementOrderNode>,
): ElementAssignment[] {
  let currentSectionId: string | null = null;
  let rootPosition = 0;
  const childPosition = new Map<string, number>();
  const assignments: ElementAssignment[] = [];

  for (const id of flatIds) {
    const element = elementsById.get(id);
    if (!element) {
      continue;
    }

    if (element.type === "section") {
      currentSectionId = id;
      childPosition.set(id, 0);
      assignments.push({ id, parent_id: null, position: rootPosition });
      rootPosition += 1;
      continue;
    }

    if (currentSectionId === null) {
      assignments.push({ id, parent_id: null, position: rootPosition });
      rootPosition += 1;
      continue;
    }

    const position = childPosition.get(currentSectionId) ?? 0;
    assignments.push({ id, parent_id: currentSectionId, position });
    childPosition.set(currentSectionId, position + 1);
  }

  return assignments;
}

export function indexAfterSectionBlock(
  flatIds: string[],
  sectionId: string,
  elementsById: Map<string, ElementOrderNode>,
): number {
  const start = flatIds.indexOf(sectionId);
  if (start < 0) {
    return flatIds.length - 1;
  }

  let index = start;
  for (let i = start + 1; i < flatIds.length; i += 1) {
    const id = flatIds[i];
    if (!id) {
      continue;
    }
    const element = elementsById.get(id);
    if (element?.type === "section") {
      break;
    }
    index = i;
  }

  return index;
}

export function getLastRootSectionId(
  elements: PageElement[],
): string | null {
  const roots = groupElementsByParent(elements).get(null) ?? [];
  for (let index = roots.length - 1; index >= 0; index -= 1) {
    if (roots[index]?.type === "section") {
      return roots[index].id;
    }
  }
  return null;
}

export function applyAssignmentsToElements(
  elements: PageElement[],
  assignments: ElementAssignment[],
): PageElement[] {
  const byId = new Map(assignments.map((row) => [row.id, row]));

  return elements.map((element) => {
    const assignment = byId.get(element.id);
    if (!assignment) {
      return element;
    }
    return {
      ...element,
      parent_id: assignment.parent_id,
      position: assignment.position,
    };
  });
}
