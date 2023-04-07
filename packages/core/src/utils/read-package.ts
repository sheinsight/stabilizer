import path from "node:path";
import isBuiltinModule from "is-builtin-module";
import { PackageJson, readPackageSync } from "read-pkg";
import memoize from "just-memoize";

export const readPackageMemoized = memoize(readPackage);

// @pnpm/types/package.json 不能解析
// type-fest 没有 main js 文件
// 先找 main, 会出现类似terser的 有多余的 package.json.错误的版本
// 先找 package.json, 有部分 exports字段的 package.json 有 warning [DEP0148]
export function readPackage(name: string, cwd: string) {
  let entryFilePath;
  try {
    const _name = isBuiltinModule(name) ? `${name}/` : name;
    entryFilePath = require.resolve(_name, { paths: [cwd] });
  } catch (error) {
    entryFilePath = require.resolve(`${name}/package.json`, { paths: [cwd] });
  }

  const dir = path.dirname(entryFilePath);

  const packageJson = readPackageSync({
    cwd: dir,
  });

  // 加一次校验 fix terser 的错误路径.
  // 不能判断 pkg.name !== pkgName, 可能导致 aa4: npm:aa@4, 寻找错误
  if (packageJson.private !== true) {
    return {
      dirPath: dir,
      filePath: path.join(dir, "package.json"),
      packageJson,
    };
  }

  return fixTerser(entryFilePath, packageJson);
}

function fixTerser(entryFilePath: string, oldPackageJson: PackageJson) {
  if (oldPackageJson.private !== true) {
    throw new Error(" terser package.json is not private");
  }
  const dir = path.resolve(path.dirname(entryFilePath), "../../");
  const packageJson = readPackageSync({
    cwd: dir,
  });
  return {
    dirPath: dir,
    filePath: path.join(dir, "package.json"),
    packageJson,
  };
}
