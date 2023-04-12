import { findDepFromCodeWhenHasSubFileImported } from "./find-dep-from-code.js";
import { describe, it, expect } from "vitest";

describe("findDepFromCode", () => {
  it("should not exist dep from require callExpression", () => {
    const code = `
      const a = require('module-a');
      const b = require('@scope/module-b');
      const c = require('./module-c');
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(0);
  });

  it("should not exist dep from require statements", () => {
    const code = `
      import a from 'module-a';
      import { b } from '@scope/module-b';
      import c from './module-c';
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(0);
  });

  it("should not exist dep from export statements", () => {
    const code = `
      export { default as a } from 'module-a';
      export { b } from '@scope/module-b';
      export { c } from './module-c';
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(0);
  });

  it("should return an empty set if no dependencies found", () => {
    const code = `
      const a = 1;
      const b = 2;
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(0);
  });

  it("should to be has subpath from require", () => {
    const code = `
      const a = require('module-a/subpath');
      const b = require('@scope/module-b');
      const c = require('./module-c');
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(1);
    expect(result.has("module-a/subpath")).toBe(true);
  });

  it("should to be has subpath from import", () => {
    const code = `
    import a from 'module-a/subpath';
    import { b } from '@scope/module-b';
    import c from './module-c';
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(1);
    expect(result.has("module-a/subpath")).toBe(true);
  });

  it("should to be has subpath from export statements", () => {
    const code = `
      export { default as a } from 'module-a/subpath';
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(1);
    expect(result.has("module-a/subpath")).toBe(true);
  });

  it("should to be has subpath from export statements", () => {
    const code = `
      export { default as a } from 'module-a/subpath';
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(1);
    expect(result.has("module-a/subpath")).toBe(true);
  });

  it("should to be has subpath from default export statements", () => {
    const code = `
        export default {}
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(1);
    expect(result.has("module-a/subpath")).toBe(true);
  });

  it("should return an empty set if require is member expression", () => {
    const code = `
        process.require("module-a/subpath")
    `;
    const result = findDepFromCodeWhenHasSubFileImported(code);
    expect(result.size).toBe(0);
  });
});
