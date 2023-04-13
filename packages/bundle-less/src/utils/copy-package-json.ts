import pick from "just-pick";
import { readPackageSync } from "read-pkg";
import { UserDepConfig } from "../typing.js";

export function readPackage(
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
