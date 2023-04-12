import fs from "node:fs";
import path from "node:path";
import { globby } from "globby";
import { writePackageSync } from "write-pkg";
import { readSrcPackage } from "./utils/copy-package-json.js";
import { findDepFromCodeWhenHasSubFileImported } from "./utils/find-dep-from-code.js";
import { npmModuleName } from "@shined/stabilizer-utils";
import { uniq } from "@shined/stabilizer-utils";

export async function bundleLess(depConfig: UserDepConfig) {
  const { srcDir, destDir, name } = depConfig;

  const packageJson = readSrcPackage(depConfig);

  // pick some fields from package.json write to destDir
  const destPackageJsonPath = path.join(destDir, "package.json");

  writePackageSync(destPackageJsonPath, packageJson.dest);

  // copy other files to destDir , but ignore package.json, readme.md, changelog.md, license
  const srcFiles = await globby("**/*", {
    ignoreFiles: ["package.json", "readme.md", "changelog.md", "license"],
    cwd: srcDir,
  });

  for (const file of srcFiles) {
    const sourceFilePath = path.join(srcDir, file);
    const destFilePath = path.join(destDir, file);
    fs.copyFileSync(sourceFilePath, destFilePath);
  }

  // alias

  const dependenciesKeys = Object.keys(packageJson.src.dependencies ?? {});

  const alias = dependenciesKeys.reduce(
    (acc, key) => ({ ...acc, [key]: `./${key}` }),
    <Record<string, string>>{}
  );
  const _alias = { ...alias, ...depConfig.externals };

  const destFiles = await globby("**/*.{js,mjs,cjs}", {
    cwd: destDir,
    absolute: true,
  });

  const subPathModules = uniq(
    destFiles
      .map((file) => fs.readFileSync(file, "utf-8"))
      .reduce(
        (acc, code) => [...acc, ...findDepFromCodeWhenHasSubFileImported(code)],
        <string[]>[]
      )
      .filter((path) => !path.endsWith("/package.json"))
      .filter((path) => !!alias[npmModuleName(path)])
  );
}
