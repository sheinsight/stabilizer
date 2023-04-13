import path from "node:path";
import { NormalizedPackageJson } from "read-pkg";
import { UserDepAdvancedConfig } from "@shined/stabilizer-types";

/**
 * merge dependencies and peerDependencies,
 * because dependencies and peerDependencies will to be installed
 * @param packageJson target module package.json
 * @returns merged dependencies and peerDependencies
 */
export function mergeRuntimeDependencies(packageJson: NormalizedPackageJson) {
  Object.keys({
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
  }).reduce(
    (acc, name) => ({ ...acc, [name]: name }),
    <Record<string, string>>{}
  );
}

/**
 * inline deps to externals
 * calculate user configures deps ,if target module is exists in deps, use it as externals use internal compiled version
 * 🤔 why acc[dep.name] = dep.name; ?
 * because has node_modules
 * @param deps {{@see UserDepAdvancedConfig[]}}
 * @returns
 */
export function getInlineDepsExternals(deps: UserDepAdvancedConfig[]) {
  // dts可能存在注释需要,不能再此处删除自身Externals
  return deps.reduce(
    (acc, dep) => ({
      ...acc,
      [dep.name]: dep.name,
    }),
    <Record<string, string>>{}
  );
}
