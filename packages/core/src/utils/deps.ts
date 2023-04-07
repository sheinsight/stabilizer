import compose from "just-compose";
import { readPackageMemoized } from "./read-package.js";
import semver from "semver";

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
  const { packageJson, dirPath } = readPackageMemoized(name, cwd);
  const entries = Object.entries(packageJson.dependencies ?? {});
  for (const [name, version] of entries) {
    const tmp = `${name}@${version}`;
    if (!list.has(tmp)) {
      list.add(tmp);
      recursiveDepsToList(name, dirPath, list);
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

// a/b  -> a
// @a/b/c -> @a/b
// ./a/b -> ./a/b
export const extractNpmScopeName = (source: string) => {
  if (source.startsWith(".")) return source;
  return source
    .split("/")
    .slice(0, source.startsWith("@") ? 2 : 1)
    .join("/");
};

function getExternalVersion(name: string, value: string, cwd: string) {
  if (name === value || value.startsWith(`../${name}`)) {
    return readPackageMemoized(name, process.cwd()).packageJson.version;
  }
  const scopeName = extractNpmScopeName(value);
  const dirPath = readPackageMemoized(scopeName, cwd).dirPath;
  return readPackageMemoized(scopeName, dirPath).packageJson.version;
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

function conflictFactory(cwd: string, externals: Record<string, string>) {
  return function conflict(deps: Record<string, string[]>) {
    const entries = Object.entries(externals);
    for (const [name, version] of entries) {
      const depVersions = deps[name];
      if (depVersions) {
        // TODO
      }
    }
  };
}

const _ = compose(recursiveDepsToList, depsToMap);
