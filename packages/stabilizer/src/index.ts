import fs from "node:fs";
import { StabilizerConfig } from "@shined/stabilizer-types";
import { mergeConfig } from "./utils/config.js";
import {
  conflictDepVResolution,
  getInlineDepsExternals,
  getOwnExternalDeps,
} from "./utils/deps.js";
import path from "node:path";

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

    // TODO
    const dir = path.dirname(dep.packageJsonReadResult.path);
    conflictDepVResolution(dep.name, dir, externals);

    if (dep.mode === "bundle-less") {
    }

    if (dep.mode === "bundle") {
    }

    if (dep.dts) {
    }

    if (dep.patch) {
    }
  }
}
