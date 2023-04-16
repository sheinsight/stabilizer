import fs from "node:fs";
import { StabilizerConfig } from "@shined/stabilizer-types";
import { mergeConfig } from "./utils/config.js";
import {
  conflictDepVResolution,
  getInlineDepsExternals,
  getOwnExternalDeps,
} from "./utils/deps.js";
import path from "node:path";
import { bundle } from "@shined/stabilizer-bundle";
import { bundleLess } from "@shined/stabilizer-bundle-less";
import resolveFrom from "resolve-from";

export async function stabilizer(userConfig: StabilizerConfig) {
  const config = mergeConfig(userConfig);
  const { cwd, packageJson } = config;

  const ownExternalDeps = getOwnExternalDeps(packageJson);

  const inlineExternalDeps = getInlineDepsExternals(config.deps);

  for (const dep of config.deps) {
    // clean compile dir
    if (dep.clean) {
      fs.rmSync(dep.output, { recursive: true, force: true });
    }

    const externals = {
      ...ownExternalDeps,
      ...config.externals,
      ...inlineExternalDeps,
      ...dep.externals,
    };

    conflictDepVResolution(dep, externals, cwd);

    const inputFile = resolveFrom(cwd, dep.name);
    const outputDir = path.join(cwd, "compiled", "node_modules");
    const inputDir = path.dirname(inputFile);

    if (dep.mode === "bundle-less") {
      await bundleLess(inputDir, outputDir, dep);
    }

    if (dep.mode === "bundle") {
      await bundle(inputFile, outputDir, dep);
    }

    if (dep.dts) {
    }

    if (dep.patch) {
    }
  }
}
