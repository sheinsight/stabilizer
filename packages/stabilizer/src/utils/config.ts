import path from "node:path";
import { readPackageSync } from "read-pkg";
import { StabilizerConfig } from "@shined/stabilizer-types";
import { defaultConfig } from "@shined/stabilizer-utils";
import { readPackage } from "@shined/n-read-pkg";

export function mergeConfig(userConfig: StabilizerConfig) {
  const config = { ...defaultConfig, ...userConfig };
  const { cwd, out } = config;
  const packageJson = readPackageSync({ cwd });

  if (!packageJson) {
    throw new Error("can not found package.json");
  }
  return {
    ...config,
    packageJson,
    deps: config.deps
      .map((dep) => (typeof dep === "string" ? { name: dep } : dep))
      .map((dep) => {
        const output = path.join(cwd, out, dep.name, "index.js"); // 根据 entry 后缀, type === 'module'??
        const minify = dep.minify ?? true;
        const dts = dep.dts ?? true;
        const clean = dep.clean ?? true;

        const packageJsonReadResult = readPackage(dep.name, cwd);

        if (!packageJsonReadResult) {
          throw new Error("Package not found: " + dep.name);
        }
        return {
          ...dep,
          dts,
          output,
          minify,
          clean,
          packageJsonReadResult,
        };
      }),
  };
}
