import { describe, expect, it } from "vitest";
import { searchReferences, REFERENCES } from "./teg-references";
describe("reference search selection", () => {
  it("label-only match retains supporting sources and unique count", () => {
    const result = searchReferences("combined deficits");
    expect(result.rules.map((r) => r.id)).toEqual(["rule-platelets"]);
    expect(result.rules[0]?.references.map((r) => r.id)).toEqual(["rossaint-2023"]);
    expect(result.bibliography.map((r) => r.id)).toEqual(["rossaint-2023"]);
  });
  it("searches limitations including source interval", () => {
    expect(searchReferences("15–32").bibliography.map((r) => r.id)).toContain("haemonetics-insert");
  });
  it("empty query shows all sources and unmatched query shows none", () => {
    expect(searchReferences("").bibliography).toEqual(REFERENCES);
    expect(searchReferences("nonexistent-query")).toEqual({ rules: [], bibliography: [] });
  });
  it("uses WHO 2025 recommendation 27 source, not obsolete standalone guidance", () => {
    expect(REFERENCES.find((r) => r.id === "who-2025")?.url).toBe(
      "https://www.ncbi.nlm.nih.gov/books/NBK619233/",
    );
    expect(REFERENCES.some((r) => r.id === "who-2017")).toBe(false);
  });
});
