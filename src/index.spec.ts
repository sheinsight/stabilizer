import { expect, it } from "vitest";
import { sum } from "./index";

it("should pass", () => {
  expect(sum(1, 1)).toBe(2);
});
