import fs from "node:fs";
import pick from "just-pick";
import path from "node:path";
import { globby } from "globby";
import { writePackageSync } from "write-pkg";
import { readPackageSync } from "read-pkg";
import type { UserDepConfig } from "@shined/stabilizer-bundle-less";
import { readSrcPackage } from "./utils/copy-package-json.js";

export async function bundleLess(depConfig: UserDepConfig) {
  const { srcDir, destDir, name } = depConfig;

  const packageJson = readSrcPackage(depConfig);

  // pick some fields from package.json write to destDir
  const destPackageJsonPath = path.join(destDir, "package.json");

  writePackageSync(destPackageJsonPath, packageJson.dest);

  // copy other files to destDir , but ignore package.json, readme.md, changelog.md, license
  const files = await globby("**/*", {
    ignoreFiles: ["package.json", "readme.md", "changelog.md", "license"],
    cwd: srcDir,
  });

  for (const file of files) {
    const sourceFilePath = path.join(srcDir, file);
    const destFilePath = path.join(destDir, file);
    fs.copyFileSync(sourceFilePath, destFilePath);
  }

  // alias

  const dependenciesKeys = Object.keys(packageJson.src.dependencies ?? {});

  const alias = dependenciesKeys.reduce((acc, key) => {
    acc[key] = `./${key}`;
    return acc;
  }, <Record<string, string>>{});
}
