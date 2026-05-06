import { useMemo } from "react";

export type PaintingState = "" | "nova" | "usada";
export type GateMaterial = "" | "madeira" | "ferro" | "aluminio" | "pvc";

export type ChecklistAttributeItem = {
  id?: string;
  item: string;
  paintingState?: PaintingState;
  gateMaterial?: GateMaterial;
  obs?: string;
  status?: string;
};

export const isGateItem = (itemName: string) => /portao/i.test(itemName);

export const isPaintingCategoryItem = (itemName: string) =>
  /pintura|paredes?|tetos?|forro|portas?/i.test(itemName);

export const requiresPaintingState = (itemName: string) =>
  isPaintingCategoryItem(itemName) || isGateItem(itemName);

export function formatChecklistObservation(row: ChecklistAttributeItem) {
  const paintLabel =
    row.paintingState === "nova"
      ? "Nova"
      : row.paintingState === "usada"
      ? "Usada"
      : "";

  const materialLabel =
    row.gateMaterial === "madeira"
      ? "Madeira"
      : row.gateMaterial === "ferro"
      ? "Ferro"
      : row.gateMaterial === "aluminio"
      ? "Aluminio"
      : row.gateMaterial === "pvc"
      ? "PVC"
      : "";

  const attrs: string[] = [];
  if (paintLabel) attrs.push(`Pintura: ${paintLabel}`);
  if (materialLabel) attrs.push(`Material: ${materialLabel}`);

  const details = attrs.length ? `[${attrs.join(" | ")}]` : "";
  if (!row.obs?.trim()) return details;
  return `${details}${details ? " - " : ""}${row.obs.trim()}`;
}

export function validateChecklistAttributes(items: ChecklistAttributeItem[]) {
  const errors = items.flatMap((row) => {
    const rowErrors: string[] = [];
    if (requiresPaintingState(row.item) && !row.paintingState) {
      rowErrors.push(`${row.item}: selecione pintura Nova/Usada`);
    }
    if (isGateItem(row.item) && !row.gateMaterial) {
      rowErrors.push(`${row.item}: selecione o material do portao`);
    }
    return rowErrors;
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function useChecklistAttributes(items: ChecklistAttributeItem[]) {
  return useMemo(() => validateChecklistAttributes(items), [items]);
}
