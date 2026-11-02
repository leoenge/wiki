import type { PageElement } from "@ww/types";
import { flattenPageElements } from "@ww/types";

export function isElementVisibleInFlow(
  element: PageElement,
  collapsedSectionIds: Readonly<Record<string, true>>,
): boolean {
  if (element.type === "section") {
    return true;
  }

  if (!element.parent_id) {
    return true;
  }

  return !collapsedSectionIds[element.parent_id];
}

export function visibleFlatIds(
  flatIds: string[],
  byId: Map<string, PageElement>,
  collapsedSectionIds: Readonly<Record<string, true>>,
): string[] {
  return flatIds.filter((id) => {
    const element = byId.get(id);
    if (!element) {
      return false;
    }
    return isElementVisibleInFlow(element, collapsedSectionIds);
  });
}

export function mergeVisibleFlatOrder(
  fullFlatIds: string[],
  visibleOrder: string[],
  collapsedSectionIds: Readonly<Record<string, true>>,
  byId: Map<string, PageElement>,
): string[] {
  const hiddenChildrenBySection = new Map<string, string[]>();

  for (const id of fullFlatIds) {
    const element = byId.get(id);
    if (!element?.parent_id || !collapsedSectionIds[element.parent_id]) {
      continue;
    }

    const list = hiddenChildrenBySection.get(element.parent_id) ?? [];
    list.push(id);
    hiddenChildrenBySection.set(element.parent_id, list);
  }

  const merged: string[] = [];
  for (const id of visibleOrder) {
    merged.push(id);
    if (byId.get(id)?.type === "section") {
      merged.push(...(hiddenChildrenBySection.get(id) ?? []));
    }
  }

  return merged;
}

export function flatIdsFromElements(elements: PageElement[]): string[] {
  return flattenPageElements(elements).map((element) => element.id);
}