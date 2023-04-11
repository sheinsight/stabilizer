import { findDepFromCode } from "./find-dep-from-code.js";
import { describe, it, expect } from "vitest";

describe("findDepFromCode", () => {
  it("should find dependencies from require", () => {
    const code = `
      const a = require('module-a');
      const b = require('@scope/module-b');
      const c = require('./module-c');
    `;
    const result = findDepFromCode(code);
    expect(result.size).toBe(2);
    expect(result.has("module-a")).toBe(true);
    expect(result.has("@scope/module-b")).toBe(true);
  });

  it("should find dependencies from import statements", () => {
    const code = `
      import a from 'module-a';
      import { b } from '@scope/module-b';
      import c from './module-c';
    `;
    const result = findDepFromCode(code);
    expect(result.size).toBe(2);
    expect(result.has("module-a")).toBe(true);
    expect(result.has("@scope/module-b")).toBe(true);
  });

  it("should find dependencies from export statements", () => {
    const code = `
      export { default as a } from 'module-a';
      export { b } from '@scope/module-b';
      export { c } from './module-c';
    `;
    const result = findDepFromCode(code);
    expect(result.size).toBe(2);
    expect(result.has("module-a")).toBe(true);
    expect(result.has("@scope/module-b")).toBe(true);
  });

  it("should return an empty set if no dependencies found", () => {
    const code = `
      const a = 1;
      const b = 2;
    `;
    const result = findDepFromCode(code);
    expect(result.size).toBe(0);
  });
});
