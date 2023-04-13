import { bundle } from "./index.js";
import { expect, it } from "vitest";
import path from "node:path";

it("should work", async () => {
  const module = "clean-webpack-plugin";

  const cwd = path.join(__dirname, "..", "fixtures", "demo1");

  const input = require.resolve(module, { paths: [cwd] });
  const output = path.join(cwd, "compiled", "node_modules", module, "index.js");
  await bundle(input, output, {
    moduleName: module,
    externals: {},
    minify: false,
  });
  const _ = require(output);
});
