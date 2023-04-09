import { stabilizer } from "./index.js";
import { expect, it } from "vitest";
import path from "node:path";

it("should work", async () => {
  const cwd = path.join(__dirname, "..", "fixtures", "demo1");
  await stabilizer(
    [
      { name: "clean-webpack-plugin", dts: false },
      { name: "speed-measure-webpack-plugin", dts: false },
      "terser",
      { name: "webpack-bundle-analyzer", dts: false },
      { name: "webpackbar", dts: false },
      { name: "webpack", dts: false },
    ],
    {
      cwd,
    }
  );
});
