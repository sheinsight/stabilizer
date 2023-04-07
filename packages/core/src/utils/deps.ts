import compose from "just-compose";
import { readPackageMemoized } from "./read-package.js";
import semver from "semver";

function isSatisfies(depVersions: string[], externalsVersion: string) {
  return depVersions
    .map((item) => item.replace("workspace:", ""))
    .every((v) => semver.satisfies(externalsVersion, v));
}

function recursiveDepsToList(
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

function depsToMap(list: Set<string>) {
  return Array.from(list).reduce<Record<string, string[]>>((acc, dep) => {
    const { name, version } = /(?<name>.+)@(?<version>.+)/.exec(dep)!.groups!;
    acc[name] = acc[name] ?? [];
    acc[name].push(version);
    return acc;
  }, {});
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
