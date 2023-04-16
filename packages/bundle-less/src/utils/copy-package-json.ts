import { UserAdvancedDepConfig } from "@shined/stabilizer-types";
import pick from "just-pick";
import { readPackageSync } from "read-pkg";

export function readPackage(srcDir: string) {
  // read package.json from srcDir
  const srcPackageJson = readPackageSync({ cwd: srcDir });
  const pickFields = [
    "name",
    "version",
    "types",
    "typings",
    "main",
    "module",
    "exports",
    "bin",
  ];
  return {
    src: srcPackageJson,
    dest: pick(srcPackageJson, pickFields),
  };
}
