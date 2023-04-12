import compose from "just-compose";
import memoize from "just-memoize";
import semver from "semver";
import fs from "node:fs";
import debug from "debug";
import path from "node:path";
import type { DepPkgInfo } from "./types.js";
import * as babel from "@babel/core";
import { readPackageMemoized } from "./utils/read-package.js";
import { npmModuleName } from "@shined/stabilizer-utils";
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

  const { packageJson: typePkg, path: typePkgPath } = res;
  const types = getDtsPathFormPkg(typePkg)!;
  console.log("--->", path.join(typePkgPath, types));

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
    const dir = path.dirname(res.path);
    return {
      fullPath: path.join(dir, dtsPath),
      pkgPath: res.path,
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

const t = babel.types;

export const getModuleDeps = (file: string) => {
  const code = fs.readFileSync(file, "utf-8");
  const ast = babel.parse(code);

  const hasSubpath = (path: string) => npmModuleName(path) !== path;

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
        if (hasSubpath(moduleArg.value)) {
          list.add(moduleArg.value);
        }
      }
    },
    ImportDeclaration: (path) => {
      const moduleArg = path.node.source;
      if (t.isStringLiteral(moduleArg)) {
        if (hasSubpath(moduleArg.value)) {
          list.add(moduleArg.value);
        }
      }
    },
    ExportDeclaration: (path) => {
      if (t.isExportDefaultDeclaration(path.node)) return;
      const moduleArg = path.node.source;
      if (t.isStringLiteral(moduleArg)) {
        if (hasSubpath(moduleArg.value)) {
          list.add(moduleArg.value);
        }
      }
    },
  });

  return list;
};
