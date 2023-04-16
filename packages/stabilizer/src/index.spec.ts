import { expect, it, describe } from "vitest";
import { stabilizer } from "./index.js";

const cwd = process.cwd();

describe("ss", () => {
  it("ss", async () => {
    await stabilizer({
      deps: ["webpack-dev-server"],
    });
  });
});
