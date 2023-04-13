import { uniq } from "./uniq.js";
import { describe, expect, it } from "vitest";

describe("uniq", () => {
  it("should to be defined", () => {
    expect(uniq).toBeDefined();
  });
  it("should return uniq array", () => {
    expect(uniq(["a", "a", "b", "c"])).toEqual(["a", "b", "c"]);
  });
});
