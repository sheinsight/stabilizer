import compose from "just-compose";
import { readPackageMemoized } from "./read-package.js";
import semver from "semver";
import nodePath from "node:path";
import { npmModuleName } from "@shined/stabilizer-utils";

function isSatisfies(depVersions: string[], externalsVersion: string) {
  return depVersions
    .map((item) => item.replace("workspace:", ""))
    .every((v) => semver.satisfies(externalsVersion, v));
}

export function recursiveDepsToList(
  name: string,
  cwd: string,
  list: Set<string> = new Set<string>()
) {
  try {
    const readResult = readPackageMemoized(name, cwd);
    const entries = Object.entries(readResult?.packageJson.dependencies ?? {});
    const dirPath = nodePath.dirname(readResult?.path!);
    for (const [name, version] of entries) {
      const tmp = `${name}@${version}`;
      if (!list.has(tmp)) {
        list.add(tmp);
        recursiveDepsToList(name, dirPath, list);
      }
    }
    return list;
  } catch (error) {}
}

export function depsToMap(list: Set<string>) {
  return Array.from(list).reduce<Record<string, string[]>>((acc, dep) => {
    const { name, version } = /(?<name>.+)@(?<version>.+)/.exec(dep)!.groups!;
    acc[name] = acc[name] ?? [];
    acc[name].push(version);
    return acc;
  }, {});
}

function getExternalVersion(name: string, value: string, cwd: string) {
  if (name === value || value.startsWith(`../${name}`)) {
    return readPackageMemoized(name, process.cwd())?.packageJson.version;
  }
  const scopeName = npmModuleName(value);
  const path = readPackageMemoized(scopeName, cwd)?.path;
  const dirPath = nodePath.dirname(path!);
  return readPackageMemoized(scopeName, dirPath)?.packageJson.version;
}

export function conflictResolution(
  name: string,
  cwd: string,
  externals: Record<string, string>
) {
  const list = recursiveDepsToList(name, cwd);
  const recursiveDepMap = depsToMap(list);
  const entries = Object.entries(externals);
  for (const [name, versions] of entries) {
    const depVersions = recursiveDepMap[name];
    if (depVersions) {
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
