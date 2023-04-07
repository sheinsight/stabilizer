import compose from "just-compose";
import memoize from "just-memoize";
import semver from "semver";
import fs from "node:fs";
import debug from "debug";
import { builtinModules } from "node:module";
import path from "node:path";
import type { DepPkgInfo } from "./types.js";
import * as babel from "@babel/core";
import { readPackage, readPackageMemoized } from "./utils/read-package.js";
import { extractNpmScopeName } from "./utils/deps.js";
export const _debug = debug(`@shined/stabilizer`);

// xxx.js -> xxx.d.ts 兼容 node esm 格式
const createDtsPath = (filePath: string) =>
  filePath
    .replace(".js", ".d.ts")
    .replace(".cjs", ".d.cts")
    .replace(".mjs", ".d.mts");

// 先临时加 .d.ts 需要考虑 .d.cts .d.mts 情况(从main.js 寻找)
const getDtsPathFormPkg = (pkg: DepPkgInfo) => {
  let dtsPath = pkg.types || pkg.typings;
  if (dtsPath && !/.d.(m|c)?ts$/.test(dtsPath as string)) {
    // 先临时加 .d.ts 需要考虑 .d.cts .d.mts 情况(从main.js 寻找)
    dtsPath = dtsPath + ".d.ts";
  }
  return dtsPath as string;
};

export const isBuildInModule = (pkgName: string) =>
  builtinModules.includes(pkgName.replace(/^node:/, ""));

const memoResolver = (...args: any[]) => JSON.stringify(args);

const getTypesPkgInfo = memoize((pkgName: string, cwd: string) => {
  // @types/xxx: @babel/core -> @types/babel__core
  const typesPkgName = `@types/${pkgName.replace("@", "").replace("/", "__")}`;

  // debug: {"types": "index"},需要注意 没d.ts后缀. 目前没有影响没有取真实路径
  // index -> index.d.ts ?? 可以从mainDtsPath 取后缀
  // yargs: types.exports 都有类型. 同时支持 mts,cts. 测试好素材

  const res = readPackageMemoized(typesPkgName, cwd);
  if (!res) {
    // TODO: 不关闭 dts.就报 warn
    // `npm view ${typesPkgName} name`?? 有的话提示安装??
    debug(`未找到${typesPkgName},可能未安装或者不存在`, cwd);
    return;
  }

  const { packageJson: typePkg, filePath: typePkgPath } = res;
  const types = getDtsPathFormPkg(typePkg)!;
  return {
    fullPath: path.join(typePkgPath, types),
    pkgPath: typePkgPath,
    types,
  };
}, memoResolver);

export type PkgDtsInfo = {
  fullPath: string;
  pkgPath: string;
  types: string;
};

export const getPkgDtsPath = (
  pkgName: string,
  cwd: string
): PkgDtsInfo | undefined => {
  const res = readPackageMemoized(pkgName, cwd);
  if (!res) {
    // dts文件. 可能直接引用 @types/xxx, 找不到 xxx
    // 如: @babel-core的index.d.ts 引用 @babel/template 实际是 @types/babel__template
    return getTypesPkgInfo(pkgName, cwd);
  }

  // inner
  const dtsPath = getDtsPathFormPkg(res.packageJson);
  if (dtsPath) {
    return {
      fullPath: path.join(res.filePath, dtsPath),
      pkgPath: res.filePath,
      types: dtsPath,
    };
  }

  try {
    // main 对应的 dts 是否存在, 参考 globby
    const mainPath = require.resolve(res.packageJson.name, { paths: [cwd] });
    const mainDtsPath = createDtsPath(mainPath);
    if (fs.existsSync(mainDtsPath))
      return {
        fullPath: mainDtsPath,
        pkgPath: res.path,
        types: path.relative(res.path, mainDtsPath),
      };
  } catch (error) {
    debug(`require.resolve(${res.packageJson.name})失败,可能是纯types pkg`);
  }

  // main 对应的 dts也找不到. 从 index.d.ts找(还有这种潜规则). 参考 deepmerge
  const defaultDtsPath = path.join(res.path, "index.d.ts");
  if (fs.existsSync(defaultDtsPath))
    return {
      fullPath: defaultDtsPath,
      pkgPath: res.path,
      types: "index.d.ts",
    };

  return getTypesPkgInfo(pkgName, cwd);
};

/**
 * 获取当前包的所有依赖(递归)
 * - pnpm 存在 workspace:* 问题
 */
const getPkgAllDeps = (
  pkgName: string,
  cwd: string,
  list: Set<string> = new Set([])
) => {
  const info = readPackageMemoized(pkgName, cwd);
  if (!info) return list;
  const dependencies = Object.entries(info.packageJson.dependencies || {}).map(
    ([name, version]) => `${name}@${version}`
  );

  // console.log(pkgName, info.pkg.version, dependencies);

  dependencies.forEach((dep) => {
    if (list.has(dep)) return;
    list.add(dep);
    const { name, version } = /(?<name>.+)@(?<version>.+)/.exec(dep)!.groups!;
    const allDeps = getPkgAllDeps(name, info.filePath, list);
    allDeps.forEach((dep) => list.add(dep));
  });

  return list;
};

// Set name@version -> Object name: [versions]
const depListToMap = (list: Set<string>) => {
  return [...list].reduce<Record<string, string[]>>((acc, dep) => {
    const { name, version } = /(?<name>.+)@(?<version>.+)/.exec(dep)!.groups!;
    acc[name] = acc[name] ? [version].concat(acc[name]) : [version];
    return acc;
  }, {});
};

export const getPkgAllDepsMap = compose(getPkgAllDeps, depListToMap);

const getIsSatisfies = (depVersions: string[], externalsVersion: string) => {
  // &&
  const isSatisfies = depVersions
    ?.map((item) => item.replace("workspace:", ""))
    ?.every((v) => semver.satisfies(externalsVersion, v));

  // ||
  // const isSatisfies = semver.satisfies(
  //   semver.minVersion(externalsVersion)!,
  //   depVersions.join(' || '),
  // );

  return isSatisfies;
};

// externals的版本号是否满足
// 1. 当前包的所有子依赖(递归)
// 2. externals -> 对应版本号(指向外部模块??)
// 3. semver 比较版本.不满足给与提示. 去除相应的externals直接打包进来
// 4. 是否考虑semver不满足(实际功能满足),也继续使用externals的选项
export const checkExternals = (
  allDeps: Record<string, string[]>,
  externals: Record<string, string>,
  rootPkgPath: string
) => {
  const notSatisfiesList: {
    name: string;
    externalVersion: string;
    depVersions: string[];
  }[] = [];

  Object.entries(externals).forEach(([name, value]) => {
    const depVersions = allDeps[name];
    if (!depVersions) return;

    const getExternalVersion = (name: string, value: string) => {
      // 'chokidar','../chokidar','../../chokidar'
      if (name === value || value.endsWith(`../${name}`)) {
        return readPackageMemoized(name, rootPkgPath)?.packageJson.version;
      }

      // 自定义外部路径 @shein-lego/xx/compiled/chokidar -> @shein-lego/xx
      const pkgName = extractNpmScopeName(value);
      const pkgPath = readPackageMemoized(pkgName, rootPkgPath)?.filePath;
      if (!pkgPath) return;
      return readPackageMemoized(pkgName, pkgPath)?.packageJson.version;
    };

    const externalVersion = getExternalVersion(name, value);
    if (!externalVersion) return;

    const isSatisfies = getIsSatisfies(depVersions, externalVersion);
    if (isSatisfies) return;

    notSatisfiesList.push({ name, externalVersion, depVersions });
  });

  return notSatisfiesList;
};

const t = babel.types;

export const getModuleDeps = (file: string) => {
  const code = fs.readFileSync(file, "utf-8");
  const ast = babel.parse(code);

  const hasSubpath = (path: string) => extractNpmScopeName(path) !== path;

  const list: Set<string> = new Set([]);
  babel.traverse(ast, {
    CallExpression: (path) => {
      if (
        !t.isIdentifier(path.node.callee, { name: "require" }) &&
        !(
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.object, { name: "require" })
        )
      ) {
        return;
      }

      const moduleArg = path.node.arguments[0];
      if (t.isStringLiteral(moduleArg)) {
        if (hasSubpath(moduleArg.value)) list.add(moduleArg.value);
      }
    },
    ImportDeclaration: (path) => {
      const moduleArg = path.node.source;
      if (t.isStringLiteral(moduleArg)) {
        if (hasSubpath(moduleArg.value)) list.add(moduleArg.value);
      }
    },
    ExportDeclaration: (path) => {
      if (t.isExportDefaultDeclaration(path.node)) return;

      const moduleArg = path.node.source;
      if (t.isStringLiteral(moduleArg)) {
        if (hasSubpath(moduleArg.value)) list.add(moduleArg.value);
      }
    },
  });

  return list;
};
