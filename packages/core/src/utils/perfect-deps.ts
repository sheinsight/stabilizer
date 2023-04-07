import path from "node:path";
import { StabilizerConfig, UserDepConfig } from "../types.js";
import { readPackageMemoized } from "./read-package.js";

export function perfectDeps(
  deps: (string | UserDepConfig)[],
  completeConfig: StabilizerConfig
) {
  const { cwd, out, externals } = completeConfig;
  return deps
    .map((dep) => {
      if (typeof dep === "string") return { name: dep };
      return dep;
    })
    .map((dep) => {
      const output = path.join(cwd, out, dep.name, "index.js"); // 根据 entry 后缀, type === 'module'??
      const outDir = path.dirname(output);
      const minify = dep.minify ?? true;
      const dts = dep.dts ?? true;

      const { packageJson, filePath } = readPackageMemoized(dep.name, cwd);

      return {
        ...dep,
        output,
        outDir,
        minify,
        dts,
        packageJson,
        packageJsonDir: path.dirname(filePath),
        packageJsonPath: filePath,
        externals: {
          ...externals,
          ...dep.externals,
        },
        clean: dep.clean ?? true,
      };
    });
}
