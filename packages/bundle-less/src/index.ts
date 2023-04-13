import fs from "node:fs";
import path from "node:path";
import { globby } from "globby";
import resolveFrom from "resolve-from";
import { UserDepConfig } from "./typing.js";
import { writePackageSync } from "write-pkg";
import { uniq } from "@shined/stabilizer-utils";
import { bundle } from "@shined/stabilizer-bundle";
import { npmModuleName } from "@shined/stabilizer-utils";
import { readPackage } from "./utils/copy-package-json.js";
import { findDepFromCodeWhenHasSubFileImported } from "./utils/find-dep-from-code.js";
import { transformFileAlias } from "./utils/transform-file-alias.js";

export async function bundleLess(depConfig: UserDepConfig) {
  const { srcDir, destDir, name, externals = {} } = depConfig;

  const packageJson = readPackage(depConfig);

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

  await Promise.all(
    subPathModules.map(async (subpath) => {
      const packageJsonDir = path.dirname(packageJson.dest.path);
      const entry = resolveFrom(packageJsonDir, subpath);
      await bundle(entry, path.join(destDir, `${subpath}.js`), {
        moduleName: subpath,
        // externals: exchangeExternals(pkgExternals), 🤔
      });
    })
  );

  await Promise.all(
    srcFiles.map(async (file) => {
      const code = await transformFileAlias(file, destDir, _alias);
      if (code) {
        fs.writeFileSync(file, code, { encoding: "utf-8" });
      } else {
        throw new Error(`transformFileAlias failed, file: ${file}`);
      }
    })
  );

  await Promise.all(
    Object.keys(packageJson.src.dependencies ?? {})
      .filter((dep) => !externals[dep] && !dep.startsWith("@types/"))
      .map((dep) => {})
  );
}
