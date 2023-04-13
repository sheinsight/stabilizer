import path from "node:path";
import { NormalizedPackageJson } from "read-pkg";
import {
  InlineUserDepAdvancedConfig,
  UserAdvancedDepConfig,
} from "@shined/stabilizer-types";
import { readPackage } from "@shined/n-read-pkg";
import semver from "semver";

/**
 * merge dependencies and peerDependencies,
 * because dependencies and peerDependencies will to be installed
 * @param packageJson target module package.json
 * @returns merged dependencies and peerDependencies
 */
export function getOwnExternalDeps(packageJson: NormalizedPackageJson) {
  return Object.keys({
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
 * @param deps {{@see UserAdvancedDepConfig[]}}
 * @returns
 */
export function getInlineDepsExternals(deps: UserAdvancedDepConfig[]) {
  // dts可能存在注释需要,不能再此处删除自身Externals
  return deps.reduce((acc, dep) => {
    // if dts only, not need to inline
    if (dep.dtsOnly) {
      return acc;
    }
    return {
      ...acc,
      [dep.name]: dep.name,
    };
  }, <Record<string, string>>{});
}

export function getRuntimeDeps(
  name: string,
  dir: string,
  list: Set<string> = new Set()
) {
  const readResult = readPackage(name, dir);
  if (!readResult) {
    throw new Error("Package not found: " + name);
  }
  const entries = Object.entries({
    ...readResult.packageJson.dependencies,
    ...readResult.packageJson.peerDependencies,
  });
  const dirPath = path.dirname(readResult.path);
  for (const [name, version] of entries) {
    const tmp = `${name}@${version}`;
    if (!list.has(tmp)) {
      list.add(tmp);
      getRuntimeDeps(name, dirPath, list);
    }
  }
  return list;
}

export function depsToMap(list: Set<string>) {
  return Array.from(list).reduce<Record<string, string[]>>((acc, dep) => {
    const { name, version } = /(?<name>.+)@(?<version>.+)/.exec(dep)!.groups!;
    acc[name] = acc[name] ?? [];
    acc[name].push(version);
    return acc;
  }, {});
}

export function isSatisfies(depVersions: string[], externalsVersion: string) {
  return depVersions
    .map((item) => item.replace("workspace:", ""))
    .every((v) => semver.satisfies(externalsVersion, v));
}

export function conflictDepVResolution(
  dep: InlineUserDepAdvancedConfig,
  externals: Record<string, string>
) {
  const dir = path.dirname(dep.packageJsonReadResult.path);
  const list = getRuntimeDeps(dep.name, dir);
  const entries = Object.entries(externals);

  const recursiveDepMap = depsToMap(list);
  for (const [name, versions] of entries) {
    const depVersions = recursiveDepMap[name];
    if (depVersions) {
      // TODO
      const externalVersion = getExternalVersion(name, versions, cwd);
      if (externalVersion) {
        if (!isSatisfies(depVersions, externalVersion)) {
          // TODO error
          delete externals[name];
        }
      }
    }
  }
}
