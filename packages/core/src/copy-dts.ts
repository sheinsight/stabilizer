import enhancedResolve from "enhanced-resolve";
import { readPackageUpSync } from "read-pkg-up";
import fs from "node:fs";
import path from "node:path";
import { _debug } from "./utils.js";
import {
  getPkgDtsPath,
  getPkgName,
  isBuildInModule,
  type PkgDtsInfo,
} from "./utils.js";

// 缓存对性能提升几乎没影响😭, 暂时只能减少重复的错误日志
const DtsCacheMap = new Map();

const filterFalse = <T>(value: T): value is Exclude<NonNullable<T>, false> =>
  Boolean(value);

/**
 * 根据入口文件 正则分析import/require 精确寻找依赖
 * 同时替换原有 import/require 到复制后的路径
 */
const copyPkgDts = (options: {
  entry: string;
  outDir: string;
  externals: Record<string, string>;
  cwd: string;
  rootDir?: string;
  cache?: Set<string>;
}) => {
  const { entry, outDir, rootDir = outDir, externals, cwd } = options;
  const { cache = new Set() } = options;

  const writeDts = (destPath: string, content: string) => {
    // console.log('destPath', destPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content);
  };

  cache.add(entry);
  const getDtsInfo = (pkgName: string) => {
    const key = pkgName + path.dirname(entry);
    if (DtsCacheMap.has(key)) return DtsCacheMap.get(key);
    const data = getPkgDtsPath(pkgName, path.dirname(entry));
    DtsCacheMap.set(key, data);
    return data;
  };

  const typePkgDir = path.dirname(
    readPackageUpSync({ cwd: path.dirname(entry) })!.path
  );
  const typesPath = entry.replace(typePkgDir, "");

  const outPath = path.join(outDir, typesPath);

  // 文件和compiled的位置??
  // index.d.ts -> ./
  // @babel/parser/typings/babel-parser -> ../../../
  let relPath = path.relative(path.dirname(outPath), rootDir);
  relPath = relPath ? relPath + "/" : "./";

  _debug({ relPath, entry, outPath, rootDir });

  const { content, localImports, depImports } = replaceImport({
    content: fs.readFileSync(entry, "utf-8"),
    externals,
    getDtsInfo,
    relPath,
  });

  writeDts(outPath, content);

  // 存在注释内模块如 ... (from webpack),无法解析
  localImports
    .map((item) => {
      // require.resolve 不支持设置 extensions,无法找到 dts 文件, 换成 resolve/enhanced-resolve
      try {
        // FIXME: why ?? 和 ncc 一起执行 报错 TypeError: Cannot read properties of undefined (reading 'uid')
        // return resolve.sync(item.replace('.js', ''), {
        //   basedir: path.dirname(entry),
        //   extensions: ['.d.ts'],
        // });

        const dtsResolve = enhancedResolve.create.sync({
          extensions: [".d.ts"],
        });

        return dtsResolve(path.dirname(entry), item.replace(".js", ""));
      } catch (error) {
        _debug("localImports 暂时无法解析", item, entry);
      }
    })
    .filter(filterFalse)
    .forEach((dtsPath) => {
      if (cache.has(dtsPath)) return;
      cache.add(dtsPath);

      copyPkgDts({
        entry: dtsPath,
        outDir,
        rootDir,
        externals,
        cwd,
        cache,
      });
    });

  // 存在注释内模块如 asdf (from 'es-module-lexer'),无法解析
  depImports.forEach((name) => {
    if (cache.has(name)) return;
    cache.add(name);
    const dtsInfo = getDtsInfo(name);

    if (!dtsInfo) {
      _debug(`depImports,未找到${name}相关dts信息`, entry);
      return;
    }

    copyPkgDts({
      entry: dtsInfo.fullPath,
      outDir: path.join(rootDir, name),
      rootDir,
      externals,
      cwd,
      cache,
    });
  });
};

type ReplaceGroup = {
  prefix: string;
  name: string;
  quota: string;
  suffix?: string;
};

const replaceImport = (options: {
  content: string;
  externals: Record<string, string>;
  getDtsInfo(pkgName: string): PkgDtsInfo | undefined;
  relPath: string;
}) => {
  let { content, externals, getDtsInfo, relPath } = options;

  const localImports: string[] = [];
  const depImports: string[] = [];

  // import MiniCssExtractPlugin = require("./index");
  // import readPkg = require('read-pkg');
  // import("schema-utils/declarations/validate").Schema;
  // import * as fs from 'fs';
  // import {Options as LocatePathOptions} from 'locate-path';
  // import { ProjectManifest } from '@pnpm/types';
  // export * from './package';

  // 场景 1: import from "xxx"
  const reg1 = /(?<prefix>import.+?from) (?<quota>['"])(?<name>[^'"]+)['"]/g;
  // 场景 2: import("xxx")
  const reg2 = /(?<prefix>import)\((?<quota>['"])(?<name>[^'"]+)['"]\)/g;
  // 场景 3: import xxx = require("xxx")
  const reg3 =
    /(?<prefix>import[^=]+?=.+?require)\((?<quota>['"])(?<name>[^'"]+)['"]\)/g;
  // 场景 4: export from "xxx"
  const reg4 = /(?<prefix>export.+?from) (?<quota>['"])(?<name>[^'"]+)['"]/g;
  // 场景 5: /// <reference path="./common/common.d.ts" />, /// <reference types="node" />
  const reg5 =
    /(?<prefix>\/\/\/ +<reference +(path|types)=)(?<quota>['"])(?<name>[^'"]+)['"] +(?<suffix>\/>)/g;

  const getRealPath = (path: string) => {
    const name = getPkgName(path);
    const subpath = path.split(name)[1];

    if (isBuildInModule(name) || name === "node") return name;

    // 本地模块
    if (name.startsWith(".")) {
      localImports.push(name);
      return name;
    }

    subpath && _debug(name, subpath, path);

    // externals模块
    if (externals[name]) {
      // 相对路径的 external 需要考虑当前文件和根目录相对路径
      if (externals[name].startsWith("."))
        return `${relPath.replace(/^.\//, "")}${externals[name]}${subpath}`;

      return `${externals[name]}${subpath}`;
    }

    // 外部模块
    depImports.push(name);

    let types = getDtsInfo(name)?.types.replace(".d.ts", "");

    if (types) {
      // 规避生成 @babel/parser/./typings/babel-parser
      if (types.startsWith("./")) types = types.replace("./", "");
      if (types !== "index")
        return `${relPath}${name}${subpath || `/${types}`}`;
    }

    return `${relPath}${name}${subpath}`;
  };

  // `${prefix} ${name}`
  const replaceWithSpace = (...args: [match: string, ...rest: any[]]) => {
    const group = args[args.length - 1] as ReplaceGroup;
    const { prefix, name, quota } = group;
    return `${prefix} ${quota}${getRealPath(name)}${quota}`;
  };

  // `${prefix}(${name})`
  const replaceWithBracket = (...args: [match: string, ...rest: any[]]) => {
    const group = args[args.length - 1] as ReplaceGroup;
    const { prefix, name, quota } = group;
    return `${prefix}(${quota}${getRealPath(name)}${quota})`;
  };

  // `${prefix}${name} ${suffix}`
  const replaceWithTripleSlash = (...args: [match: string, ...rest: any[]]) => {
    const group = args[args.length - 1] as ReplaceGroup;
    const { prefix, name, suffix = "", quota } = group;
    return `${prefix}${quota}${getRealPath(name)}${quota} ${suffix}`;
  };

  content = content.replace(reg1, replaceWithSpace);
  content = content.replace(reg2, replaceWithBracket);
  content = content.replace(reg3, replaceWithBracket);
  content = content.replace(reg4, replaceWithSpace);
  content = content.replace(reg5, replaceWithTripleSlash);

  return {
    content,
    localImports,
    depImports,
  };
};

export default copyPkgDts;
