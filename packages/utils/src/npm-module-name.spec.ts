import { npmModuleName } from "./npm-module-name.js";
import { describe, it, expect } from "vitest";

describe("npmModuleName", () => {
  it('should return the input if it starts with "."', () => {
    const input = "./my-module";
    const result = npmModuleName(input);
    expect(result).toBe(input);
  });

  it("should return the correct module name for non-scoped package", () => {
    const input = "some-module/path/to/file";
    const result = npmModuleName(input);
    expect(result).toBe("some-module");
  });

  it("should return the correct module name for scoped package", () => {
    const input = "@scope/some-module/path/to/file";
    const result = npmModuleName(input);
    expect(result).toBe("@scope/some-module");
  });

  it("should return the correct module name for scoped package", () => {
    const input = "lodash";
    const result = npmModuleName(input);
    expect(result).toBe("lodash");
  });

  it("should return the correct module name for scoped package", () => {
    const input = "@sheind/lodash";
    const result = npmModuleName(input);
    expect(result).toBe("@sheind/lodash");
  });
});
