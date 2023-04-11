import path from "node:path";
import { StabilizerConfig, UserDepConfig } from "../types.js";
import { NormalizedPackageJson } from "read-pkg";

export function calcSelfExternals(packageJson: NormalizedPackageJson) {
  return Object.keys({
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
  }).reduce(
    (acc, name) => ({
      ...acc,
      [name]: name,
    }),
    {}
  );
}

export function calcDepsExternals(
  name: string,
  deps: UserDepConfig[],
  config: StabilizerConfig
) {
  const { cwd, out } = config;
  return deps.reduce((acc, dep) => {
    if (name !== dep.name) {
      acc[dep.name] = path.relative(
        path.join(cwd, out, name),
        path.join(cwd, out, dep.name)
      );
    } else {
      acc[dep.name] = `../${name}`; // dts可能存在注释需要,不能再此处删除自身Externals
    }

    return acc;
  }, {} as Record<string, string>);
}
