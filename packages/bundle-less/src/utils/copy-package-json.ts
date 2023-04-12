import { UserDepConfig } from "@shined/stabilizer-bundle-less";
import pick from "just-pick";
import path from "node:path";
import { readPackageSync } from "read-pkg";
import { writePackageSync } from "write-pkg";

export function readSrcPackage(
  depConfig: Pick<UserDepConfig, "srcDir" | "destDir">
) {
  const { srcDir } = depConfig;
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
