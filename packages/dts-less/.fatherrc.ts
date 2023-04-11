import { defineConfig } from "father";
import path from "node:path";

export default defineConfig({
  extends: path.resolve(__dirname, "..", "..", ".fatherrc.ts"),
});
