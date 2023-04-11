import { defineConfig } from "father";

export default defineConfig({
  esm: {
    output: "es",
  },
  targets: {
    node: 14,
  },
});
