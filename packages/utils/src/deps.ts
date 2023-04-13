import { NormalizedPackageJson } from "read-pkg";

export function mergeRuntimeDependencies(packageJson: NormalizedPackageJson) {
  Object.keys({
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
  }).reduce(
    (acc, name) => ({ ...acc, [name]: name }),
    <Record<string, string>>{}
  );
}

export function name(name: string) {}
