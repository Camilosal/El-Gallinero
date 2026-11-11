import { describe, expect, it } from "vitest";
import { CREATE_ACTION_GROUPS } from "@/lib/create-actions";
import { searchNavigation, searchEntries } from "@/lib/navigation";

describe("catálogo compartido de acciones", () => {
  it("expone en el buscador todas las acciones del menú Crear", () => {
    const searchable = new Set(searchEntries.map((entry) => `${entry.label}|${entry.href}`));
    const actions = CREATE_ACTION_GROUPS.flatMap((group) => group.actions);
    expect(actions.length).toBeGreaterThan(20);
    for (const action of actions) expect(searchable.has(`${action.label}|${action.href}`)).toBe(true);
  });

  it("encuentra acciones por su nombre en el buscador global", () => {
    expect(searchNavigation("registrar mortalidad").some((entry) => entry.label === "Registrar mortalidad")).toBe(true);
    expect(searchNavigation("crear alimento").some((entry) => entry.label === "Crear alimento")).toBe(true);
  });
});
