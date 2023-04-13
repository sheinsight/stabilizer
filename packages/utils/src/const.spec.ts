import { describe, it, expect } from "vitest";
import { defaultConfig } from "./const.js";
describe("const", () => {
  it("should be define", () => {
    expect(defaultConfig).toEqual({
      out: "compiled",
      cwd: process.cwd(),
      externals: {},
    });
  });
});
