import { describe, expect, it } from "vitest";
import { citiesForDepartment, isKnownDepartment, listColombiaDepartments } from "@/lib/colombia-places";

describe("colombia places", () => {
  it("lista departamentos con Bogotá D.C.", () => {
    const departments = listColombiaDepartments();
    expect(departments).toContain("Sucre");
    expect(departments).toContain("Bogotá D.C.");
  });

  it("carga ciudades según el departamento", () => {
    expect(citiesForDepartment("Sucre")).toContain("Sincelejo");
    expect(citiesForDepartment("Bogotá D.C.")).toEqual(["Bogotá"]);
    expect(citiesForDepartment("")).toEqual([]);
  });

  it("reconoce departamentos conocidos", () => {
    expect(isKnownDepartment("Antioquia")).toBe(true);
    expect(isKnownDepartment("Marte")).toBe(false);
  });
});
